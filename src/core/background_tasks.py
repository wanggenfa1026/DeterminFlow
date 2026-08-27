"""后台任务引用持有 - 防止 fire-and-forget 任务在完成前被 GC

事件循环对任务只持弱引用。`create_task(coro)` 的返回值若不保存，任务可能在
运行完成前被垃圾回收，表现为事件丢失或回调静默不执行。

在拆分执行器模式下这尤其关键：事件推送会经 loopback 转发回 Controller，
是真实的异步 IO，任务存活时间明显变长，被回收的窗口也随之变大。
"""
import asyncio
import logging
from typing import Any, Coroutine

logger = logging.getLogger(__name__)

_background_tasks: set[asyncio.Task] = set()


def spawn_background_task(
    coro: Coroutine[Any, Any, Any],
    *,
    name: str | None = None,
    loop: asyncio.AbstractEventLoop | None = None,
) -> asyncio.Task | None:
    """创建后台任务并在其生命周期内持有强引用。

    Args:
        coro: 要执行的协程
        name: 任务名，便于调试
        loop: 指定事件循环；省略时使用当前运行的循环

    Returns:
        创建的 Task；无可用事件循环时关闭协程并返回 None
    """
    try:
        target_loop = loop or asyncio.get_running_loop()
    except RuntimeError:
        coro.close()
        logger.debug("没有运行中的事件循环，后台任务未创建: %s", name)
        return None

    task = target_loop.create_task(coro, name=name)
    _background_tasks.add(task)
    task.add_done_callback(_on_task_done)
    return task


def _on_task_done(task: asyncio.Task) -> None:
    _background_tasks.discard(task)
    if task.cancelled():
        return
    exception = task.exception()
    if exception is not None:
        logger.debug("后台任务异常结束: %s", task.get_name(), exc_info=exception)


def pending_background_task_count() -> int:
    """当前仍被持有的后台任务数，用于诊断。"""
    return len(_background_tasks)
