package id.komikaid.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeGoogleAuthPlugin.class);
        registerPlugin(NativeUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
