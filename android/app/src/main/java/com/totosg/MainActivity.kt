package com.totosg

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.swmansion.rnscreens.fragment.restoration.RNScreensFragmentFactory

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    // DO NOT REMOVE either line below.
    //
    // When Android kills the app in the background and later re-opens it, it
    // tries to restore the old fragments. react-native-screens forbids this and
    // crashes with "Screen fragments should never be restored". React rebuilds
    // all screens from JS anyway, so there is no saved state we need here.
    //
    // 1. Passing null tells Android not to restore any old fragments at all.
    //    This is the fix recommended by react-native-screens.
    // 2. The fragment factory is a second safety net: if a screen fragment is
    //    ever restored, it is swapped for a harmless placeholder. It depends on
    //    the -keepnames rule for com.swmansion.rnscreens in proguard-rules.pro;
    //    without that rule R8 renames the classes and this check stops working
    //    (that is what broke v2.8.1).
    supportFragmentManager.fragmentFactory = RNScreensFragmentFactory()
    super.onCreate(null)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "TotoSG"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
