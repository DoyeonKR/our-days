import { colorStrength, cropFrame34, hasVideoColor, videoFilter, type VideoFilterId } from "./videoColor.ts";
import { LOG_VIDEO_BPS, LOG_VIDEO_FALLBACK_MAX_S, LOG_VIDEO_MS, pickVideoMime, rawFallbackAllowed } from "./logvideo.ts";
import {beautyPreset,type BeautyPresetId} from "./videoBeauty.ts";

const VERTEX=`attribute vec2 position; varying vec2 uv; void main(){uv=(position+1.0)*0.5;gl_Position=vec4(position,0.0,1.0);}`;
// crop = 원본 텍스처에서 읽을 3:4 가운데 칸(왼쪽, 아래, 폭, 높이). 거울은 칸 안에서 뒤집는다(가운데 자르기라 좌우 대칭).
const FRAGMENT=`precision mediump float; varying vec2 uv; uniform sampler2D image; uniform vec4 tone; uniform vec3 tint; uniform float strength; uniform float mirror; uniform float beauty; uniform vec4 correction; uniform vec2 texel; uniform vec4 crop;
void main(){vec2 p=crop.xy+vec2(mix(uv.x,1.0-uv.x,mirror),uv.y)*crop.zw;vec3 raw=texture2D(image,p).rgb;
// Edge-aware smoothing: reject dissimilar neighbours instead of blurring eyes/edges.
// No skin-colour threshold, facial reshaping, face detection, or remote processing.
vec3 base=raw;
if(beauty>0.0){vec3 sum=raw;float total=1.0;
for(int y=-2;y<=2;y++){for(int x=-2;x<=2;x++){
vec2 offset=vec2(float(x),float(y));vec3 sampleColor=texture2D(image,p+offset*texel*1.5).rgb;
vec3 delta=sampleColor-raw;float weight=exp(-dot(offset,offset)*.25-dot(delta,delta)*120.0);
sum+=sampleColor*weight;total+=weight;}}
vec3 smoothColor=sum/total;
base=mix(raw,smoothColor,min(1.0,beauty*correction.x*.85))+(raw-smoothColor)*correction.z*beauty;
base=clamp(base+correction.y*beauty*(1.0-base),0.0,1.0);
base=mix(base,sqrt(base),correction.w*beauty);
}
vec3 sep=vec3(dot(base,vec3(.393,.769,.189)),dot(base,vec3(.349,.686,.168)),dot(base,vec3(.272,.534,.131)));
vec3 c=((mix(base,sep,tone.x)*tone.z-.5)*tone.y+.5)*tint;float l=dot(c,vec3(.2126,.7152,.0722));c=clamp(mix(vec3(l),c,tone.w),0.0,1.0);
gl_FragColor=vec4(mix(base,c,strength),1.0);}`;
export type ColorCrop=readonly [number,number,number,number];
const FULL_CROP:ColorCrop=[0,0,1,1];
/** loseOnDispose — 버릴 캔버스(파일 폴백의 임시 캔버스)에서만 컨텍스트를 놓는다.
 *  ⚠ 미리보기 캔버스는 놓지 않는다: 같은 캔버스의 getContext 는 '잃은 컨텍스트'를 그대로 돌려줘서,
 *  카메라를 바꾸거나(facing) 다시 연결(camTry)한 뒤 셰이더 컴파일이 실패했고 → 필터가 꺼지고
 *  전면 영상이 거울 없이 저장됐다(README '3초 로그 카메라' 결정 위반). 화면 쪽은 카메라마다 캔버스를 새로 단다(key). */
export function createColorRenderer(canvas:HTMLCanvasElement,opts:{loseOnDispose?:boolean}={}) {
  const loseOnDispose=opts.loseOnDispose??true;
  const gl=canvas.getContext("webgl",{alpha:false,antialias:false,preserveDrawingBuffer:true,powerPreference:"low-power"});
  if(!gl)throw Error("이 브라우저에서 색감 처리를 지원하지 않아요. 원본으로 촬영해 주세요.");
  if(gl.isContextLost())throw Error("색감 처리를 다시 준비해야 해요. 카메라를 다시 열어 주세요.");
  const shaders:WebGLShader[]=[];let disposed=false;let crop:ColorCrop=FULL_CROP;
  function compile(type:number,source:string){const shader=gl!.createShader(type);if(!shader)throw Error("필터를 준비하지 못했어요.");shaders.push(shader);gl!.shaderSource(shader,source);gl!.compileShader(shader);if(!gl!.getShaderParameter(shader,gl!.COMPILE_STATUS))throw Error("필터를 준비하지 못했어요.");return shader;}
  const program=gl.createProgram(),buffer=gl.createBuffer(),texture=gl.createTexture();
  function dispose(){if(disposed)return;disposed=true;gl!.deleteTexture(texture);gl!.deleteBuffer(buffer);if(program)gl!.deleteProgram(program);shaders.forEach(s=>gl!.deleteShader(s));if(loseOnDispose)gl!.getExtension("WEBGL_lose_context")?.loseContext();}
  try {
    if(!program||!buffer||!texture)throw Error("필터 메모리를 준비하지 못했어요.");
    gl.attachShader(program,compile(gl.VERTEX_SHADER,VERTEX));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FRAGMENT));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error("필터를 준비하지 못했어요.");
    gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const pos=gl.getAttribLocation(program,"position");gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    const tone=gl.getUniformLocation(program,"tone"),tint=gl.getUniformLocation(program,"tint"),strength=gl.getUniformLocation(program,"strength"),mirror=gl.getUniformLocation(program,"mirror");gl.uniform1i(gl.getUniformLocation(program,"image"),0);
    const beautyLocation=gl.getUniformLocation(program,"beauty"),correction=gl.getUniformLocation(program,"correction"),texel=gl.getUniformLocation(program,"texel"),cropLocation=gl.getUniformLocation(program,"crop");
    return {
      /** 원본에서 읽을 3:4 칸 — 카메라가 돌아가 원본 크기가 바뀌면(resize) 다시 맞춘다. */
      setCrop(next:ColorCrop){crop=next;},
      draw(source:TexImageSource,id:VideoFilterId,amount:number,flipped=false,beauty=0,preset:BeautyPresetId="natural"){
        if(disposed||gl.isContextLost())throw Error("색감 처리가 중단됐어요. 다시 찍어주세요.");
        const f=videoFilter(id);gl.viewport(0,0,canvas.width,canvas.height);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,source);
        gl.uniform4f(cropLocation,crop[0],crop[1],crop[2],crop[3]);
        gl.uniform1f(beautyLocation,colorStrength(beauty));gl.uniform2f(texel,crop[2]/canvas.width,crop[3]/canvas.height);
        const b=beautyPreset(preset);gl.uniform4f(correction,b.smoothing,b.exposure,b.detail,b.glow);
        gl.uniform4f(tone,f.sepia,f.contrast,f.brightness,f.saturation);gl.uniform3fv(tint,new Float32Array(f.tint));gl.uniform1f(strength,colorStrength(amount));gl.uniform1f(mirror,flipped?1:0);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);gl.flush();
        if(gl.getError()!==gl.NO_ERROR)throw Error("영상의 색감을 처리하지 못했어요. 다시 시도해 주세요.");
      },dispose,
    };
  } catch(error){dispose();throw error;}
}
/** Capture the processed bitmap, never the CSS-styled source video. */
export function captureColorStream(canvas:HTMLCanvasElement):MediaStream {
  if(typeof canvas.captureStream!=="function")throw Error("이 브라우저는 색감 영상 저장을 지원하지 않아요. 원본을 선택해 주세요.");
  const stream=canvas.captureStream(24);
  if(!stream.getVideoTracks().some(t=>t.readyState==="live")){stream.getTracks().forEach(t=>t.stop());throw Error("필터 영상 녹화를 준비하지 못했어요.");}
  return stream;
}

/** 파일 폴백(카메라 앱)도 화면 촬영과 같은 규격으로 다시 굽는다 — 3:4 가운데 자르기 · 3초로 자르기 · mp4/webm.
 *  예전엔 보정이 없으면 원본 파일을 그대로 올렸다: 아이폰은 HEVC .mov(5초에 최대 25MB)가 올라가
 *  안드로이드 상대는 재생을 못 했고, 3초 규칙도 4:3/16:9 모양도 그대로였다.
 *  다시 굽지 못하는 환경(녹화 · 캔버스 녹화 미지원)에서만 보정 없는 원본을 그대로 쓴다(reencoded=false).
 *  보정을 골랐는데 굽지 못하면 원본으로 몰래 바꾸지 않고 실패로 알린다. */
export async function colorVideoFile(file:Blob,id:VideoFilterId,strength:number,signal:AbortSignal,beauty=0,preset:BeautyPresetId="natural"):Promise<{blob:Blob;mime:string;reencoded:boolean}> {
  const video=document.createElement("video"),url=URL.createObjectURL(file),canvas=document.createElement("canvas");
  video.muted=true;video.playsInline=true;video.preload="auto";
  let renderer:ReturnType<typeof createColorRenderer>|null=null,stream:MediaStream|null=null,rec:MediaRecorder|null=null,frameTimer:ReturnType<typeof setInterval>|null=null,trimTimer:ReturnType<typeof setTimeout>|null=null;
  const plain=!hasVideoColor(id,strength)&&colorStrength(beauty)===0;
  const raw=()=>{if(!rawFallbackAllowed(file.type||"video/mp4"))throw Error("이 형식의 영상은 올릴 수 없어요. 다른 영상을 골라 주세요.");return {blob:file,mime:file.type||"video/mp4",reencoded:false};};
  try {
    await new Promise<void>((resolve,reject)=>{const cleanup=()=>{clearTimeout(timer);video.onloadeddata=null;video.onerror=null;signal.removeEventListener("abort",abort);};const abort=()=>{cleanup();reject(new DOMException("취소됨","AbortError"));};const timer=setTimeout(()=>{cleanup();reject(Error("영상을 읽는 시간이 너무 오래 걸려요."));},15000);video.onloadeddata=()=>{cleanup();resolve();};video.onerror=()=>{cleanup();reject(Error("영상을 읽을 수 없어요."));};signal.addEventListener("abort",abort,{once:true});if(signal.aborted)abort();else video.src=url;});
    const seek=(time:number)=>new Promise<void>((resolve,reject)=>{const cleanup=()=>{clearTimeout(timer);video.onseeked=null;video.onerror=null;signal.removeEventListener("abort",abort);};const abort=()=>{cleanup();reject(new DOMException("취소됨","AbortError"));};const timer=setTimeout(()=>{cleanup();reject(Error("영상 길이를 확인하지 못했어요."));},10000);video.onseeked=()=>{cleanup();resolve();};video.onerror=()=>{cleanup();reject(Error("영상을 읽을 수 없어요."));};signal.addEventListener("abort",abort,{once:true});if(signal.aborted)abort();else video.currentTime=time;});
    // MediaRecorder WebM can omit duration. A bounded seek discovers the end before export.
    if(!Number.isFinite(video.duration)){await seek(1e10);await seek(0);}
    if(!Number.isFinite(video.duration)||video.duration<=0||video.duration>LOG_VIDEO_FALLBACK_MAX_S+.1)throw Error(`${LOG_VIDEO_FALLBACK_MAX_S}초 이내의 길이를 확인할 수 있는 영상을 선택해 주세요.`);
    const canRecord=typeof MediaRecorder!=="undefined"&&typeof canvas.captureStream==="function";
    if(!canRecord){if(plain)return raw();throw Error("이 브라우저는 색감 영상 저장을 지원하지 않아요. 원본을 선택해 주세요.");}
    const limit=Math.min(video.duration,LOG_VIDEO_MS/1000);
    try {
      const frame=cropFrame34(video.videoWidth,video.videoHeight);canvas.width=frame.width;canvas.height=frame.height;renderer=createColorRenderer(canvas);renderer.setCrop(frame.crop);renderer.draw(video,id,strength,false,beauty,preset);stream=captureColorStream(canvas);
      const mime=pickVideoMime(m=>MediaRecorder.isTypeSupported(m));rec=mime?new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:LOG_VIDEO_BPS}):new MediaRecorder(stream,{videoBitsPerSecond:LOG_VIDEO_BPS});
      const actual=rec.mimeType||mime||"video/webm",chunks:BlobPart[]=[];
      const blob=await new Promise<Blob>((resolve,reject)=>{
        let done=false,frames=0;const cleanup=()=>{clearTimeout(timer);if(trimTimer!==null)clearTimeout(trimTimer);signal.removeEventListener("abort",abort);document.removeEventListener("visibilitychange",onVisibility);video.onended=null;video.onerror=null;};
        const fail=(error:Error)=>{if(done)return;done=true;cleanup();reject(error);};const abort=()=>fail(new DOMException("취소됨","AbortError"));
        const timer=setTimeout(()=>fail(Error("필터 영상 처리가 멈췄어요. 다시 시도해 주세요.")),(limit+8)*1000);
        const onVisibility=()=>{if(document.visibilityState==="hidden")fail(Error("화면을 벗어나 영상 처리를 취소했어요. 화면을 켜 둔 채 다시 시도해 주세요."));};document.addEventListener("visibilitychange",onVisibility);
        signal.addEventListener("abort",abort,{once:true});if(signal.aborted){abort();return;}
        const stop=()=>{if(rec?.state==="recording")rec.stop();};
        rec!.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};rec!.onerror=()=>fail(Error("필터 영상 저장을 지원하지 않는 환경이에요. 원본을 선택해 주세요."));
        rec!.onstop=()=>{if(done)return;done=true;cleanup();const out=new Blob(chunks,{type:actual});if(out.size&&frames>=Math.max(3,Math.floor(limit*6)))resolve(out);else reject(Error("영상 프레임이 충분히 처리되지 않았어요. 화면을 켜 둔 채 다시 시도해 주세요."));};
        video.onended=stop;video.onerror=()=>fail(Error("영상 재생 중 오류가 났어요."));
        // 3초 규칙 — 5초 영상도 앞 3초만 굽는다(시계 + 재생 위치 둘 다 본다: 타이머가 밀려도 재생 위치가 막는다).
        const draw=()=>{if(done||video.readyState<2)return;if(video.currentTime>=limit){stop();return;}try{renderer!.draw(video,id,strength,false,beauty,preset);frames++;}catch(error){fail(error instanceof Error?error:Error("필터 처리 실패"));}};
        rec!.onstart=()=>{draw();if(!done){frameTimer=setInterval(draw,1000/24);video.play().then(()=>{trimTimer=setTimeout(stop,limit*1000+80);}).catch(()=>fail(Error("영상 처리를 시작할 수 없어요. 다시 선택해 주세요.")));}};
        try{rec!.start(500);}catch{fail(Error("필터 녹화를 시작하지 못했어요. 원본을 선택하거나 다시 시도해 주세요."));}
      });
      return {blob,mime:actual,reencoded:true};
    } catch(error) {
      // 보정 없는 원본은 굽기에 실패해도 그대로 올릴 수 있다(예전 동작). 보정을 골랐으면 실패를 그대로 알린다.
      if((error as {name?:string})?.name==="AbortError"||!plain)throw error;
      return raw();
    }
  } finally {
    if(frameTimer!==null)clearInterval(frameTimer);if(trimTimer!==null)clearTimeout(trimTimer);if(rec){rec.onstart=null;rec.ondataavailable=null;rec.onstop=null;rec.onerror=null;if(rec.state!=="inactive")try{rec.stop();}catch{}}
    stream?.getTracks().forEach(t=>t.stop());renderer?.dispose();video.pause();video.removeAttribute("src");video.load();URL.revokeObjectURL(url);
  }
}
