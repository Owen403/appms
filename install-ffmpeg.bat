@echo off
echo Installing FFmpeg for yt-dlp...

REM Create ffmpeg directory if it doesn't exist
if not exist "C:\ffmpeg" mkdir "C:\ffmpeg"

REM Download ffmpeg (you might need to update this URL to the latest version)
echo Downloading FFmpeg...
curl -L "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip" -o "ffmpeg.zip"

if exist "ffmpeg.zip" (
    echo Extracting FFmpeg...
    powershell -command "Expand-Archive -Path 'ffmpeg.zip' -DestinationPath 'C:\ffmpeg' -Force"
    
    REM Add to PATH (this will add to current session)
    set "PATH=%PATH%;C:\ffmpeg\ffmpeg-master-latest-win64-gpl\bin"
    
    echo FFmpeg installed successfully!
    echo You may need to restart your command prompt for PATH changes to take effect.
    
    REM Clean up
    del "ffmpeg.zip"
    
    echo Testing FFmpeg installation...
    C:\ffmpeg\ffmpeg-master-latest-win64-gpl\bin\ffmpeg -version
) else (
    echo Failed to download FFmpeg
)

pause
