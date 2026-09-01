@echo off
rem DeterminFlow dev server launcher - keeps cwd at project root so ./data resolves correctly
cd /d "%~dp0"
set PYTHONUNBUFFERED=1
set PYTHONUTF8=1
".venv\Scripts\python.exe" run.py
