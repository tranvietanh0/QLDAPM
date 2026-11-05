@echo off
chcp 65001 >nul
echo == KIEM TRA JAVA (can JDK 21) ==
java -version
echo.
echo == KIEM TRA MAVEN (can Maven 3.9+) ==
mvn -version
echo.
echo == KIEM TRA NODE (can Node 20+) ==
node --version
echo.
echo == KIEM TRA NPM ==
npm --version
echo.
echo == KIEM TRA CONG 8081 / 5173 ==
netstat -ano | findstr ":8081 :5173"
echo.
echo Xem README.md de xu ly neu lenh bao NOT RECOGNIZED.
pause
