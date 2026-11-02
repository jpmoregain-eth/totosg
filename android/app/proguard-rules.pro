# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# React Native, Hermes, Firebase, Google Mobile Ads and the other native
# libraries ship their own consumer ProGuard/R8 rules, so blanket
# `-keep class ... { *; }` rules are not needed here. Keeping whole packages
# prevents R8 from obfuscating them and drags down Play Console's
# DEX optimization score.

# Keep line numbers so crash reports stay readable.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# react-native-screens: do NOT let R8 rename its Fragment classes.
# MainActivity installs RNScreensFragmentFactory, which recognises screen
# fragments being restored by checking that the class name starts with
# "com.swmansion.rnscreens". When R8 renamed them (e.g. to "K1.f") that
# check failed, Android rebuilt a real ScreenFragment and the app crashed
# with "Screen fragments should never be restored" (v2.8.1, versionCode 25).
# The library does not ship its own consumer rules for this, so keep the
# names here. Shrinking and optimisation are still allowed.
-keepnames class com.swmansion.rnscreens.** extends androidx.fragment.app.Fragment
