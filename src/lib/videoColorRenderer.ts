import { colorFrameSize, colorStrength, hasVideoColor, videoFilter, type VideoFilterId } from "./videoColor.ts";
import { LOG_VIDEO_BPS, LOG_VIDEO_FALLBACK_MAX_S, pickVideoMime } from "./logvideo.ts";

const VERTEX=`attribute vec2 position; varying vec2 uv; void main(){uv=(position+1.0)*0.5;gl_Position=vec4(position,0.0,1.0);}`;
const FRAGMENT=`precision mediump float; varying vec2 uv; uniform sampler2D image; uniform vec4 tone; uniform vec3 tint; uniform float strength; uniform float mirror;
void main(){vec2 p=vec2(mix(uv.x,1.0-uv.x,mirror),uv.y);vec3 raw=texture2D(image,p).rgb;
vec3 sep=vec3(dot(raw,vec3(.393,.769,.189)),dot(raw,vec3(.349,.686,.168)),dot(raw,vec3(.272,.534,.131)));
vec3 c=((mix(raw,sep,tone.x)*tone.z-.5)*tone.y+.5)*tint;float l=dot(c,vec3(.2126,.7152,.0722));c=clamp(mix(vec3(l),c,tone.w),0.0,1.0);
gl_FragColor=vec4(mix(raw,c,strength),1.0);}`;
export function createColorRenderer(canvas:HTMLCanvasElement) {
  const gl=canvas.getContext("webgl",{alpha:false,antialias:false,preserveDrawingBuffer:true,powerPreference:"low-power"});
  if(!gl)throw Error("이 브라우저에서 색감 처리를 지원하지 않아요. 원본으로 촬영해 주세요.");
  const shaders:WebGLShader[]=[];let disposed=false;
  function compile(type:number,source:string){const shader=gl!.createShader(type);if(!shader)throw Error("필터를 준비하지 못했어요.");shaders.push(shader);gl!.shaderSource(shader,source);gl!.compileShader(shader);if(!gl!.getShaderParameter(shader,gl!.COMPILE_STATUS))throw Error("필터를 준비하지 못했어요.");return shader;}
  const program=gl.createProgram(),buffer=gl.createBuffer(),texture=gl.createTexture();
  function dispose(){if(disposed)return;disposed=true;gl!.deleteTexture(texture);gl!.deleteBuffer(buffer);if(program)gl!.deleteProgram(program);shaders.forEach(s=>gl!.deleteShader(s));gl!.getExtension("WEBGL_lose_context")?.loseContext();}
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
    return {
      draw(source:TexImageSource,id:VideoFilterId,amount:number,flipped=false){
        if(disposed||gl.isContextLost())throw Error("색감 처리가 중단됐어요. 다시 찍어주세요.");
        const f=videoFilter(id);gl.viewport(0,0,canvas.width,canvas.height);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,source);
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

/** Native-camera fallback also bakes color; failure never silently uploads an unfiltered file. */
export async function colorVideoFile(file:Blob,id:VideoFilterId,strength:number,signal:AbortSignal):Promise<{blob:Blob;mime:string}> {
  const video=document.createElement("video"),url=URL.createObjectURL(file),canvas=document.createElement("canvas");
  video.muted=true;video.playsInline=true;video.preload="auto";
  let renderer:ReturnType<typeof createColorRenderer>|null=null,stream:MediaStream|null=null,rec:MediaRecorder|null=null,raf=0;
  try {
    await new Promise<void>((resolve,reject)=>{const cleanup=()=>{clearTimeout(timer);video.onloadeddata=null;video.onerror=null;signal.removeEventListener("abort",abort);};const abort=()=>{cleanup();reject(new DOMException("취소됨","AbortError"));};const timer=setTimeout(()=>{cleanup();reject(Error("영상을 읽는 시간이 너무 오래 걸려요."));},15000);video.onloadeddata=()=>{cleanup();resolve();};video.onerror=()=>{cleanup();reject(Error("영상을 읽을 수 없어요."));};signal.addEventListener("abort",abort,{once:true});if(signal.aborted)abort();else video.src=url;});
    const seek=(time:number)=>new Promise<void>((resolve,reject)=>{const cleanup=()=>{clearTimeout(timer);video.onseeked=null;video.onerror=null;signal.removeEventListener("abort",abort);};const abort=()=>{cleanup();reject(new DOMException("취소됨","AbortError"));};const timer=setTimeout(()=>{cleanup();reject(Error("영상 길이를 확인하지 못했어요."));},10000);video.onseeked=()=>{cleanup();resolve();};video.onerror=()=>{cleanup();reject(Error("영상을 읽을 수 없어요."));};signal.addEventListener("abort",abort,{once:true});if(signal.aborted)abort();else video.currentTime=time;});
    // MediaRecorder WebM can omit duration. A bounded seek discovers the end before export.
    if(!Number.isFinite(video.duration)){await seek(1e10);await seek(0);}
    if(!Number.isFinite(video.duration)||video.duration<=0||video.duration>LOG_VIDEO_FALLBACK_MAX_S+.1)throw Error(`${LOG_VIDEO_FALLBACK_MAX_S}초 이내의 길이를 확인할 수 있는 영상을 선택해 주세요.`);
    if(!hasVideoColor(id,strength))return {blob:file,mime:file.type||"video/mp4"};
    if(typeof MediaRecorder==="undefined")throw Error("이 브라우저는 색감 영상 저장을 지원하지 않아요. 원본을 선택해 주세요.");
    const size=colorFrameSize(video.videoWidth,video.videoHeight);canvas.width=size.width;canvas.height=size.height;renderer=createColorRenderer(canvas);renderer.draw(video,id,strength);stream=captureColorStream(canvas);
    const mime=pickVideoMime(m=>MediaRecorder.isTypeSupported(m));rec=mime?new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:LOG_VIDEO_BPS}):new MediaRecorder(stream,{videoBitsPerSecond:LOG_VIDEO_BPS});
    const actual=rec.mimeType||mime||"video/webm",chunks:BlobPart[]=[];
    const blob=await new Promise<Blob>((resolve,reject)=>{
      let done=false,frames=0;const cleanup=()=>{clearTimeout(timer);signal.removeEventListener("abort",abort);document.removeEventListener("visibilitychange",onVisibility);video.onended=null;video.onerror=null;};
      const fail=(error:Error)=>{if(done)return;done=true;cleanup();reject(error);};const abort=()=>fail(new DOMException("취소됨","AbortError"));
      const timer=setTimeout(()=>fail(Error("필터 영상 처리가 멈췄어요. 다시 시도해 주세요.")),(video.duration+8)*1000);
      const onVisibility=()=>{if(document.visibilityState==="hidden")fail(Error("화면을 벗어나 영상 처리를 취소했어요. 화면을 켜 둔 채 다시 시도해 주세요."));};document.addEventListener("visibilitychange",onVisibility);
      signal.addEventListener("abort",abort,{once:true});if(signal.aborted){abort();return;}
      rec!.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};rec!.onerror=()=>fail(Error("필터 영상 저장을 지원하지 않는 환경이에요. 원본을 선택해 주세요."));
      rec!.onstop=()=>{if(done)return;done=true;cleanup();const out=new Blob(chunks,{type:actual});if(out.size&&frames>=Math.max(3,Math.floor(video.duration*6)))resolve(out);else reject(Error("영상 프레임이 충분히 처리되지 않았어요. 화면을 켜 둔 채 다시 시도해 주세요."));};
      video.onended=()=>{if(rec?.state==="recording")rec.stop();};video.onerror=()=>fail(Error("영상 재생 중 오류가 났어요."));
      const draw=()=>{try{renderer!.draw(video,id,strength);frames++;raf=requestAnimationFrame(draw);}catch(error){fail(error instanceof Error?error:Error("필터 처리 실패"));}};
      rec!.onstart=()=>{draw();if(!done)video.play().catch(()=>fail(Error("영상 처리를 시작할 수 없어요. 다시 선택해 주세요.")));};
      try{rec!.start();}catch{fail(Error("필터 녹화를 시작하지 못했어요. 원본을 선택하거나 다시 시도해 주세요."));}
    });
    return {blob,mime:actual};
  } finally {
    cancelAnimationFrame(raf);if(rec){rec.onstart=null;rec.ondataavailable=null;rec.onstop=null;rec.onerror=null;if(rec.state!=="inactive")try{rec.stop();}catch{}}
    stream?.getTracks().forEach(t=>t.stop());renderer?.dispose();video.pause();video.removeAttribute("src");video.load();URL.revokeObjectURL(url);
  }
}
