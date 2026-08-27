"""敏感路径拒绝表 - 路径沙箱关闭时的兜底防护

沙箱关闭时允许工具访问 workspace 之外的路径，但系统目录和凭据目录始终拒绝。
拒绝表按运行平台解析：Unix 系统目录、Windows 系统目录、以及两个平台共有的
用户凭据目录。

本模块是 workspace_guard 和 coding_tools 共用的唯一实现，避免两处校验分叉。
"""
import os
from pathlib import Path

# 凭据文件名：即使位于可访问目录，这些文件也始终拒绝
SENSITIVE_FILE_NAMES = frozenset({
    ".env",
    "id_rsa",
    "id_dsa",
    "id_ecdsa",
    "id_ed25519",
    "credentials",
    "models_config.json",
})

_UNIX_SYSTEM_DIRS = ("/etc", "/proc", "/sys", "/dev", "/boot", "/root")

# 相对用户 home 的凭据目录，两个平台通用
_HOME_CREDENTIAL_DIRS = (
    ".ssh",
    ".aws",
    ".gnupg",
    ".kube",
    ".docker",
    ".azure",
    ".config/gcloud",
)

_CACHED_DIRS: tuple[Path, ...] | None = None


def _windows_system_dirs() -> list[Path]:
    """从环境变量解析 Windows 系统目录，不硬编码盘符。"""
    dirs: list[Path] = []
    for var in ("SystemRoot", "windir", "ProgramFiles", "ProgramFiles(x86)", "ProgramData"):
        value = os.environ.get(var)
        if value:
            dirs.append(Path(value))
    return dirs


def sensitive_dirs() -> tuple[Path, ...]:
    """返回当前平台的敏感目录列表（已 resolve，结果缓存）。"""
    global _CACHED_DIRS
    if _CACHED_DIRS is not None:
        return _CACHED_DIRS

    candidates: list[Path] = []
    if os.name == "nt":
        candidates.extend(_windows_system_dirs())
    else:
        candidates.extend(Path(d) for d in _UNIX_SYSTEM_DIRS)

    try:
        home = Path.home()
    except (RuntimeError, OSError):
        home = None
    if home is not None:
        candidates.extend(home / relative for relative in _HOME_CREDENTIAL_DIRS)

    resolved: list[Path] = []
    for candidate in candidates:
        try:
            resolved.append(candidate.resolve())
        except (OSError, ValueError):
            continue

    _CACHED_DIRS = tuple(resolved)
    return _CACHED_DIRS


def check_sensitive_path(path: Path) -> str | None:
    """检查路径是否命中敏感目录或凭据文件名。

    Args:
        path: 已 resolve 的绝对路径

    Returns:
        命中时返回拒绝原因，未命中返回 None
    """
    if path.name in SENSITIVE_FILE_NAMES:
        return f"拒绝访问凭据文件: {path.name}"

    for sensitive in sensitive_dirs():
        if path == sensitive or _is_relative_to(path, sensitive):
            return f"拒绝访问敏感目录: {sensitive}"
    return None


def _is_relative_to(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False
