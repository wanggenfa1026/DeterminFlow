"""
路径沙箱 + 命令鉴权 - 确保所有文件操作和命令执行在安全范围内

参考 Roo-Code:
- 路径安全: src/utils/pathUtils.ts + src/core/ignore/RooIgnoreController.ts
- 命令审批: src/core/auto-approval/commands.ts

安全规则：
1. 工具接收的 path 参数一律视为相对于 session workspace 的路径
2. 绝对路径输入直接拒绝
3. ../ 穿越检测：resolve() 后必须仍在 workspace 目录内
4. 符号链接逃逸检测：os.path.realpath() 后再次验证
5. 文件大小限制
"""
import os
import shlex
import logging
from pathlib import Path
from typing import Optional

import src.config as config
from src.core.sensitive_paths import check_sensitive_path
from src.core.types import GuardResult

logger = logging.getLogger(__name__)


class WorkspaceGuard:
    """路径沙箱 + 命令鉴权守卫"""

    def __init__(self, workspace_manager=None, approval_manager=None):
        self._workspace_manager = workspace_manager
        self._approval_manager = approval_manager

    def validate_path(
        self,
        workspace_path: str,
        target_path: str,
        *,
        enforce_workspace: bool = False,
    ) -> GuardResult:
        """验证目标路径是否在 workspace 沙箱内

        Args:
            workspace_path: Session 的 workspace 根目录（绝对路径）
            target_path: 工具接收的路径参数
            enforce_workspace: 强制要求路径位于 workspace 内，忽略沙箱开关。
                供 HTTP 接口等必须受限的调用方使用。

        Returns:
            GuardResult，allowed=True 表示路径安全
        """
        if not workspace_path:
            return GuardResult(allowed=False, reason="未配置 workspace 路径")

        workspace = Path(workspace_path).resolve()
        if not workspace.exists():
            return GuardResult(allowed=False, reason=f"Workspace 路径不存在: {workspace}")

        # 路径沙箱关闭：允许访问 workspace 之外，但系统目录和凭据文件始终拒绝
        if not config.CODING_PATH_SANDBOX_ENABLED and not enforce_workspace:
            resolved = Path(os.path.realpath(str(workspace / target_path)))
            reason = check_sensitive_path(resolved)
            if reason:
                return GuardResult(allowed=False, reason=reason)
            return GuardResult(allowed=True)

        # 规则 2: 拒绝绝对路径输入
        if os.path.isabs(target_path):
            return GuardResult(allowed=False, reason=f"不允许使用绝对路径: {target_path}")

        # 规则 3: 路径穿越检测
        resolved = (workspace / target_path).resolve()
        try:
            resolved.relative_to(workspace)
        except ValueError:
            return GuardResult(
                allowed=False,
                reason=f"路径穿越检测失败: {target_path} 解析为 {resolved}，不在 {workspace} 内"
            )

        # 规则 4: 符号链接逃逸检测
        real_path = Path(os.path.realpath(str(resolved)))
        try:
            real_path.relative_to(workspace)
        except ValueError:
            return GuardResult(
                allowed=False,
                reason=f"符号链接逃逸检测失败: 真实路径 {real_path} 不在 {workspace} 内"
            )

        return GuardResult(allowed=True)

    def get_effective_path(
        self,
        workspace_path: str,
        relative_path: str,
        *,
        enforce_workspace: bool = False,
    ) -> Path | None:
        """将工具接收的相对路径转为 workspace 下的安全绝对路径

        Args:
            workspace_path: workspace 根目录
            relative_path: 相对路径
            enforce_workspace: 强制要求结果位于 workspace 内，忽略沙箱开关

        Returns:
            安全的绝对路径，验证失败返回 None
        """
        result = self.validate_path(
            workspace_path, relative_path, enforce_workspace=enforce_workspace
        )
        if not result.allowed:
            logger.warning(f"路径验证失败: {result.reason}")
            return None
        workspace = Path(workspace_path).resolve()
        return (workspace / relative_path).resolve()

    def check_file_size(self, path: Path, for_write: bool = False) -> GuardResult:
        """检查文件大小是否超过配置上限

        Args:
            path: 文件路径
            for_write: 是否为写操作（写操作时文件可能不存在）

        Returns:
            GuardResult
        """
        max_size = config.CODING_MAX_FILE_SIZE
        if path.exists() and path.is_file():
            size = path.stat().st_size
            if size > max_size:
                return GuardResult(
                    allowed=False,
                    reason=f"文件大小 {size} bytes 超过限制 {max_size} bytes"
                )
        return GuardResult(allowed=True)

    def validate_command(self, workspace_path: str, command: str) -> GuardResult:
        """验证命令是否允许执行

        根据审批模式和黑白名单决定是否放行/需审批/拒绝。

        Args:
            workspace_path: workspace 路径（用于 cwd 验证）
            command: 要执行的命令字符串

        Returns:
            GuardResult
        """
        mode = config.CODING_CMD_MODE

        if mode == "allow_all":
            return GuardResult(allowed=True)

        if mode == "approve_all":
            return GuardResult(allowed=False, needs_approval=True, reason="当前模式要求所有命令均需审批")

        # 获取命令前缀（第一个 token）
        try:
            cmd_parts = shlex.split(command)
        except ValueError:
            # shlex 无法解析的畸形命令（如未闭合引号），降级为简单分割
            cmd_parts = command.strip().split()
        if not cmd_parts:
            return GuardResult(allowed=False, reason="空命令")
        cmd_name = cmd_parts[0]

        # 危险语法检测（管道、重定向、换行等链式命令）
        # 底层以 shell=True 执行，换行与重定向同样可以追加额外动作
        dangerous_chars = ["|", "&&", "||", ";", "`", "$(", "&", ">", "<", "\n", "\r"]
        has_chain = any(dc in command for dc in dangerous_chars)

        # 解释器可以通过 -c/-e 执行任意代码，绕过按命令名的白名单匹配
        if self._is_inline_code_execution(cmd_parts):
            return GuardResult(
                allowed=False, needs_approval=True,
                reason=f"命令通过解释器内联执行代码，需要审批: {command[:100]}"
            )

        if mode == "whitelist":
            whitelist = [w.strip() for w in config.CODING_CMD_WHITELIST.split(",") if w.strip()]
            # 最长前缀匹配
            if self._match_command_list(command, cmd_name, whitelist):
                # 白名单匹配，但如果有链式命令语法，仍需审批
                if has_chain:
                    return GuardResult(
                        allowed=False, needs_approval=True,
                        reason=f"命令包含链式语法，需要审批: {command[:100]}"
                    )
                return GuardResult(allowed=True)
            return GuardResult(
                allowed=False, needs_approval=True,
                reason=f"命令 '{cmd_name}' 不在白名单中"
            )

        if mode == "blacklist":
            blacklist = [b.strip() for b in config.CODING_CMD_BLACKLIST.split(",") if b.strip()]
            if self._match_command_list(command, cmd_name, blacklist):
                return GuardResult(
                    allowed=False, needs_approval=True,
                    reason=f"命令匹配黑名单: {command[:100]}"
                )
            # 黑名单只匹配首个命令，链式语法可以把危险命令藏在良性前缀之后
            # （如 `echo hi && rm -rf /`），因此链式命令一律需要审批。
            if has_chain:
                return GuardResult(
                    allowed=False, needs_approval=True,
                    reason=f"命令包含链式语法，需要审批: {command[:100]}"
                )
            return GuardResult(allowed=True)

        # 未知模式，默认需要审批
        return GuardResult(allowed=False, needs_approval=True, reason=f"未知审批模式: {mode}")

    @staticmethod
    def _is_inline_code_execution(cmd_parts: list[str]) -> bool:
        """检测解释器内联执行代码（如 python -c、node -e）

        白名单按命令名匹配，`python` 命中白名单后 `python -c "任意代码"` 会被直接
        放行，等同于任意代码执行。这里识别常见解释器的内联执行参数并要求审批。
        """
        if not cmd_parts:
            return False
        # 去掉路径和 .exe 后缀，取解释器名
        name = Path(cmd_parts[0]).name.lower()
        if name.endswith(".exe"):
            name = name[:-4]
        # python3.11 / python3 等带版本号的形式
        base = name.rstrip("0123456789.")

        inline_flags = {
            "python": {"-c", "-m"},
            "python3": {"-c", "-m"},
            "py": {"-c", "-m"},
            "node": {"-e", "-p", "--eval", "--print"},
            "nodejs": {"-e", "-p", "--eval", "--print"},
            "perl": {"-e", "-E"},
            "ruby": {"-e"},
            "php": {"-r"},
            "bash": {"-c"},
            "sh": {"-c"},
            "zsh": {"-c"},
            "powershell": {"-c", "-command", "-encodedcommand"},
            "pwsh": {"-c", "-command", "-encodedcommand"},
            "cmd": {"/c", "/k"},
        }
        flags = inline_flags.get(name) or inline_flags.get(base)
        if not flags:
            return False
        return any(arg.lower() in flags for arg in cmd_parts[1:])

    @staticmethod
    def _match_command_list(full_command: str, cmd_name: str, patterns: list[str]) -> bool:
        """检查命令是否匹配模式列表

        参考 Roo-Code commands.ts 的匹配逻辑：
        - 模式可以是命令名（如 "npm"）
        - 也可以是多 token 前缀（如 "rm -rf /"）

        匹配规则：
        - 单 token 模式：精确匹配命令名
        - 多 token 模式：逐 token 前缀匹配（避免 "rm -rf" 误匹配 "rm -rfi"）
        """
        try:
            cmd_tokens = shlex.split(full_command.strip())
        except ValueError:
            cmd_tokens = full_command.strip().split()

        for pattern in patterns:
            pattern = pattern.strip()
            if not pattern:
                continue
            if " " not in pattern:
                # 单 token 模式：精确匹配命令名
                if cmd_name == pattern:
                    return True
            else:
                # 多 token 模式：逐 token 前缀匹配
                try:
                    pattern_tokens = shlex.split(pattern)
                except ValueError:
                    pattern_tokens = pattern.split()
                if len(cmd_tokens) >= len(pattern_tokens) and cmd_tokens[:len(pattern_tokens)] == pattern_tokens:
                    return True
        return False
