package id.komikaid.app;

import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;

@CapacitorPlugin(name = "NativeGoogleAuth")
public class NativeGoogleAuthPlugin extends Plugin {
    @PluginMethod
    public void signIn(PluginCall call) {
        String serverClientId = call.getString("serverClientId");
        if (serverClientId == null || serverClientId.trim().isEmpty()) {
            call.reject("Google web client ID is missing.");
            return;
        }

        GoogleSignInOptions options = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(serverClientId)
            .requestEmail()
            .build();
        GoogleSignInClient client = GoogleSignIn.getClient(getContext(), options);
        client.signOut().addOnCompleteListener(getActivity(), task ->
            startActivityForResult(call, client.getSignInIntent(), "handleSignInResult")
        );
    }

    @ActivityCallback
    private void handleSignInResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getData() == null) {
            call.reject("Google sign-in was cancelled.");
            return;
        }

        Intent data = result.getData();
        Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
        try {
            GoogleSignInAccount account = task.getResult(ApiException.class);
            String idToken = account.getIdToken();
            if (idToken == null || idToken.isEmpty()) {
                call.reject("Google did not return an identity token.");
                return;
            }
            JSObject response = new JSObject();
            response.put("idToken", idToken);
            call.resolve(response);
        } catch (ApiException error) {
            int statusCode = error.getStatusCode();
            String message = statusCode == 10
                ? "Google Android OAuth is not configured for this package and signing certificate."
                : "Google sign-in failed (" + statusCode + ").";
            call.reject(message, String.valueOf(statusCode), error);
        }
    }
}
