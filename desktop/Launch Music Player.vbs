Set objShell = CreateObject("WScript.Shell")
objShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)

' Check if node_modules exists
Set fso = CreateObject("Scripting.FileSystemObject")
If Not fso.FolderExists("node_modules") Then
    ' First time run - show installation window
    objShell.Run "cmd /c run-dev.bat", 1, True
Else
    ' Normal run - hide window
    objShell.Run "cmd /c npm start", 0, False
End If

Set objShell = Nothing
Set fso = Nothing
