"""DeterminFlow development entry point.

Production uses the Gunicorn command declared by the Docker image.
"""
import faulthandler
import os
import sys
from pathlib import Path

# 将项目根目录加入 sys.path
sys.path.insert(0, str(Path(__file__).parent))

# 段错误诊断：进程被 SIGSEGV 杀死时，Python 层没有任何 traceback，
# 事件日志只会记录 "unknown 模块"。启用后崩溃瞬间的调用栈会写入
# logs/faulthandler.log，可定位是哪个 C 扩展触发的。
# 只注册一次：faulthandler.enable() 后一次调用会覆盖前一次，而后台
# 运行时 stderr 通常被丢弃，因此固定写文件。
_fault_log = Path(__file__).parent / "logs" / "faulthandler.log"
_fault_log.parent.mkdir(parents=True, exist_ok=True)
_fault_fp = open(_fault_log, "a", buffering=1, encoding="utf-8", errors="replace")
faulthandler.enable(file=_fault_fp, all_threads=True)

npm_cmd = "npm.cmd" if os.name == "nt" else "npm"


def _build_frontend_if_needed():
    """检测前端源码是否比 dist 更新，如果是则自动构建。"""
    import subprocess, os

    root = Path(__file__).parent
    web_dir = root / "web"
    src_dir = web_dir / "src"
    dist_dir = web_dir / "dist"

    if not src_dir.exists():
        return  # 没有前端源码，跳过

    # 如果 dist 不存在，必须构建
    needs_build = not dist_dir.exists()

    if not needs_build:
        # 比较 src 最新修改时间 vs dist/index.html
        dist_marker = dist_dir / "index.html"
        if not dist_marker.exists():
            needs_build = True
        else:
            dist_mtime = dist_marker.stat().st_mtime
            for f in src_dir.rglob("*"):
                if f.is_file() and f.stat().st_mtime > dist_mtime:
                    needs_build = True
                    break

    if not needs_build:
        return

    # 检查 node_modules 是否存在
    if not (web_dir / "node_modules").exists():
        print("  📦 安装前端依赖...")
        subprocess.run([npm_cmd, "install"], cwd=str(web_dir), check=True)

    print("  🔨 前端源码有更新，正在构建...")
    subprocess.run([npm_cmd, "run", "build"], cwd=str(web_dir), check=True)
    print("  ✅ 前端构建完成\n")


if __name__ == "__main__":
    import os
    import uvicorn
    from dotenv import load_dotenv

    load_dotenv()

    _build_frontend_if_needed()

    # 日志级别唯一入口：需要诊断日志时设置 LOG_LEVEL=DEBUG
    os.environ.setdefault("LOG_LEVEL", "INFO")

    from src.web_server import app

    host = os.getenv("WEB_HOST", "0.0.0.0")
    port = int(os.getenv("WEB_PORT", "8020"))

    print(f"\n  🚀 DeterminFlow")
    print(f"  http://localhost:{port}")
    print(f"  API docs: http://localhost:{port}/docs\n")

    # 并发限制：防止事件循环被过载（百级 Agent 并发时数千 coroutine 竞争）
    limit_concurrency = int(os.getenv("UVICORN_LIMIT_CONCURRENCY", "200"))
    backlog = int(os.getenv("UVICORN_BACKLOG", "2048"))

    # openai/pydantic 在解析大响应时会做深层递归的 schema 重建
    # （construct_type → model_rebuild → _generate_schema），默认 ~1MB
    # 线程栈会被打爆，进程直接以访问违例死亡且无任何 Python 层报错
    # （faulthandler.log 2026-08-29 00:22 捕获）。放到 64MB 栈的线程里跑。
    import threading

    threading.stack_size(64 * 1024 * 1024)
    server_thread = threading.Thread(
        target=uvicorn.run,
        args=("src.web_server:app",),
        kwargs=dict(
            host=host,
            port=port,
            reload=False,
            log_level="info",
            limit_concurrency=limit_concurrency,
            backlog=backlog,
        ),
        name="uvicorn-main",
    )
    server_thread.start()
    server_thread.join()
