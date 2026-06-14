package id.komikaid.app;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Set;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "NativeUpdater")
public class NativeUpdaterPlugin extends Plugin {
    private static final long MAX_APK_SIZE = 300L * 1024L * 1024L;
    private static final Set<String> ALLOWED_HOSTS = Set.of(
        "github.com",
        "objects.githubusercontent.com",
        "release-assets.githubusercontent.com",
        "github-releases.githubusercontent.com"
    );

    @PluginMethod
    public void getCurrentVersion(PluginCall call) {
        try {
            var info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            JSObject result = new JSObject();
            result.put("versionName", info.versionName);
            result.put("versionCode", Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? info.getLongVersionCode()
                : info.versionCode);
            call.resolve(result);
        } catch (PackageManager.NameNotFoundException error) {
            call.reject("Unable to read app version", error);
        }
    }

    @PluginMethod
    public void canInstallPackages(PluginCall call) {
        JSObject result = new JSObject();
        result.put("allowed", Build.VERSION.SDK_INT < Build.VERSION_CODES.O
            || getContext().getPackageManager().canRequestPackageInstalls());
        call.resolve(result);
    }

    @PluginMethod
    public void openInstallPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        String fileName = call.getString("fileName", "komikaid.apk");
        if (url == null || !fileName.toLowerCase().endsWith(".apk")) {
            call.reject("Invalid APK request");
            return;
        }
        Executors.newSingleThreadExecutor().execute(() -> {
            try {
                File updateDir = new File(getContext().getCacheDir(), "updates");
                if (!updateDir.exists() && !updateDir.mkdirs()) throw new Exception("Unable to create update directory");
                File apk = new File(updateDir, "komikaid-update.apk");
                download(url, apk);
                Uri uri = FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    apk
                );
                Intent install = new Intent(Intent.ACTION_VIEW);
                install.setDataAndType(uri, "application/vnd.android.package-archive");
                install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(install);
                call.resolve();
            } catch (Exception error) {
                call.reject("APK update failed", error);
            }
        });
    }

    private void download(String source, File destination) throws Exception {
        URL current = new URL(source);
        for (int redirects = 0; redirects <= 5; redirects++) {
            if (!"https".equals(current.getProtocol()) || !ALLOWED_HOSTS.contains(current.getHost())) {
                throw new SecurityException("Blocked update host");
            }
            HttpURLConnection connection = (HttpURLConnection) current.openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(15_000);
            connection.setReadTimeout(60_000);
            connection.setRequestProperty("User-Agent", "KomikaID-Android-Updater");
            int status = connection.getResponseCode();
            if (status >= 300 && status < 400) {
                String location = connection.getHeaderField("Location");
                connection.disconnect();
                if (location == null) throw new Exception("Invalid update redirect");
                current = new URL(current, location);
                continue;
            }
            if (status < 200 || status >= 300) throw new Exception("Update server returned " + status);
            long total = connection.getContentLengthLong();
            if (total <= 0 || total > MAX_APK_SIZE) throw new Exception("Invalid APK size");
            try (
                BufferedInputStream input = new BufferedInputStream(connection.getInputStream(), 64 * 1024);
                FileOutputStream output = new FileOutputStream(destination)
            ) {
                byte[] buffer = new byte[64 * 1024];
                long downloaded = 0;
                int lastProgress = -1;
                int read;
                while ((read = input.read(buffer)) != -1) {
                    downloaded += read;
                    if (downloaded > MAX_APK_SIZE) throw new Exception("APK exceeds size limit");
                    output.write(buffer, 0, read);
                    int progress = (int) Math.min(100, downloaded * 100 / total);
                    if (progress != lastProgress) {
                        lastProgress = progress;
                        JSObject event = new JSObject();
                        event.put("progress", progress);
                        notifyListeners("downloadProgress", event);
                    }
                }
            } finally {
                connection.disconnect();
            }
            return;
        }
        throw new Exception("Too many update redirects");
    }
}
