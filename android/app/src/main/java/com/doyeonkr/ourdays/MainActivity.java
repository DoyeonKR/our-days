package com.doyeonkr.ourdays;

import android.net.Uri;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.PickVisualMediaRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

/*
 * 사진 · 영상 고르기는 갤러리(사진 선택기)부터 — 2026-11-06 [사용자: "이미지 올릴 때 기본을 갤러리에서 먼저 찾을 수 있게 해줘
 * 자꾸 내 파일이나 다른 곳을 보는 것 같아"].
 * Capacitor 기본 WebChromeClient 는 <input type=file> 을 ACTION_GET_CONTENT(파일 앱 · 최근 항목)로 연다.
 * accept 가 사진 · 영상뿐이고 촬영(capture)이 아니면 안드로이드 사진 선택기(PickVisualMedia)로 연다 — 갤러리처럼 앨범 · 사진이 먼저 보인다.
 * 사진 선택기가 없는 옛 기기는 androidx 가 알아서 문서 선택기로 돌아간다. 그 밖의 파일 · 촬영은 원래 길(super) 그대로.
 */
public class MainActivity extends BridgeActivity {

    private ValueCallback<Uri[]> pendingPick;
    private ActivityResultLauncher<PickVisualMediaRequest> pickOne;
    private ActivityResultLauncher<PickVisualMediaRequest> pickMany;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 결과 받기는 화면이 시작되기 전에 등록해야 한다(onStart 전) — super 보다 먼저
        pickOne = registerForActivityResult(new ActivityResultContracts.PickVisualMedia(), uri -> deliver(uri == null ? null : new Uri[] { uri }));
        pickMany = registerForActivityResult(
            new ActivityResultContracts.PickMultipleVisualMedia(30),
            uris -> deliver(uris == null || uris.isEmpty() ? null : uris.toArray(new Uri[0]))
        );
        super.onCreate(savedInstanceState);
        Bridge bridge = getBridge();
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().setWebChromeClient(new GalleryFirstChromeClient(bridge));
        }
    }

    private void deliver(Uri[] result) {
        ValueCallback<Uri[]> cb = pendingPick;
        pendingPick = null;
        if (cb != null) cb.onReceiveValue(result);
    }

    /** accept 가 사진만 / 영상만 / 둘 다면 그 종류, 다른 파일이 섞였으면 null */
    static ActivityResultContracts.PickVisualMedia.VisualMediaType mediaTypeOf(String[] accept) {
        boolean image = false, video = false;
        if (accept == null) return null;
        for (String raw : accept) {
            if (raw == null) continue;
            for (String part : raw.split(",")) {
                String t = part.trim().toLowerCase();
                if (t.isEmpty()) continue;
                if (t.startsWith("image/")) image = true;
                else if (t.startsWith("video/")) video = true;
                else return null; // .pdf · 확장자 지정 등 — 파일 앱이 맞다
            }
        }
        if (image && video) return ActivityResultContracts.PickVisualMedia.ImageAndVideo.INSTANCE;
        if (image) return ActivityResultContracts.PickVisualMedia.ImageOnly.INSTANCE;
        if (video) return ActivityResultContracts.PickVisualMedia.VideoOnly.INSTANCE;
        return null;
    }

    private class GalleryFirstChromeClient extends BridgeWebChromeClient {

        GalleryFirstChromeClient(Bridge bridge) {
            super(bridge);
        }

        @Override
        public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, WebChromeClient.FileChooserParams params) {
            ActivityResultContracts.PickVisualMedia.VisualMediaType type = params == null || params.isCaptureEnabled() ? null : mediaTypeOf(params.getAcceptTypes());
            if (type == null) return super.onShowFileChooser(webView, filePathCallback, params);
            if (pendingPick != null) pendingPick.onReceiveValue(null); // 앞서 연 것이 답 없이 남았으면 닫아 준다(웹뷰가 다시 못 연다)
            pendingPick = filePathCallback;
            PickVisualMediaRequest request = new PickVisualMediaRequest.Builder().setMediaType(type).build();
            try {
                if (params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) pickMany.launch(request);
                else pickOne.launch(request);
                return true;
            } catch (RuntimeException e) {
                pendingPick = null;
                return super.onShowFileChooser(webView, filePathCallback, params);
            }
        }
    }
}
