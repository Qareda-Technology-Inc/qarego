# QareGO: use Android Studio JDK when JAVA_HOME is unset (macOS)
if [ -z "$JAVA_HOME" ] && [ -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]; then
  JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
elif [ -z "$JAVA_HOME" ] && [ -d "/Applications/Android Studio.app/Contents/jbr" ]; then
  JAVA_HOME="/Applications/Android Studio.app/Contents/jbr"
fi
