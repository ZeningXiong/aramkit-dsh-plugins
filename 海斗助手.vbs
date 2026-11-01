Option Explicit
Dim appShell, fileSystem, repositoryRoot, launcher
Set appShell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")
repositoryRoot = fileSystem.GetParentFolderName(WScript.ScriptFullName)
launcher = fileSystem.BuildPath(repositoryRoot, "packages\aramkit-web\launch.ps1")
appShell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File " & Chr(34) & launcher & Chr(34), 0, False
