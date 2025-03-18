import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { WizardConfigService } from '../wizard-config.service';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-jana',
    templateUrl: './jana.component.html',
    styleUrl: './jana.component.css',
    standalone: false
})
export class JanaComponent implements OnInit, AfterViewInit, OnDestroy  {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  private currentSound?: THREE.Audio;
  public isRecording = false;
  public isWaitingForAgent = false;
  constructor(
    public wizardConfigService: WizardConfigService,
    private router: Router
  ) {}

  private audioContext!: AudioContext;
  private analyser!: THREE.AudioAnalyser;
  private dataArray!: Uint8Array;
  private audio!: HTMLAudioElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private animationId: number | null = null;
  private sphere!: THREE.Mesh;
  private clock = new THREE.Clock();
  private uniforms: { [key: string]: { value: any } } = {
    u_time: { value: 0.0 },
    u_resolution: { value: new THREE.Vector2(800, 800) },
    u_frequency: {value: 0.0},
    u_isRecording: { value: 0.0 }
  };

  /** 
   * Flag to detect if we're dealing with a short clip. 
   * (For an extra visual "boost") 
   */
  private isShortClip = false;
  public chatMessages: string[] = [];
  public newChatMessage: string = '';

  ngOnInit() {
    console.log('User Name:', this.wizardConfigService.userName);
    console.log('Command Word:', this.wizardConfigService.commandWord);
    console.log('Wizard Finished:', this.wizardConfigService.wizardFinished);
    console.log('Audio Src:', this.wizardConfigService.selectedAudioSrc);
  }

  ngAfterViewInit(): void {
    this.initThree();
    this.startAnimationLoop();
  }

  ngOnDestroy(): void {
    // Clean up the animation loop
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }
  sendChatMessage() {
    if (this.newChatMessage.trim()) {
      this.chatMessages.push(`You: ${this.newChatMessage}`);
      // Instead of simulating a response, call the agent:
      this.sendToAgent(this.newChatMessage);
      this.newChatMessage = '';
    }
  }
  async sendToAgent(text: string) {
    try {
      const agentResponse = await fetch('http://localhost:8000/run_task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ task: text })
      });
      if (!agentResponse.ok) {
        console.error('Agent request failed', agentResponse.statusText);
        this.chatMessages.push("Jana: Agent request failed.");
        return;
      }
      const reader = agentResponse.body?.getReader();
      if (!reader) {
        console.error('No reader available for agentResponse');
        this.chatMessages.push("Jana: No agent response available.");
        return;
      }
      const decoder = new TextDecoder();
      let finalReply = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunkText = decoder.decode(value, { stream: true });
        console.log('SSE chunk from agent:', chunkText);
        const lines = chunkText.split('\n');
        finalReply = chunkText
        // for (const line of lines) {
        //   if (line.startsWith('data: ')) {
        //     const jsonStr = line.slice('data: '.length).trim();
        //     try {
        //       const message = JSON.parse(jsonStr);
        //       if (message.type === 'Result') {
        //         finalReply = message.message;
        //       }
        //       if (message.status === 'completed') {
        //         console.log('SSE stream completed');
        //         await reader.cancel();
        //         break;
        //       }
        //     } catch (err) {
        //       console.error('Error parsing SSE chunk:', err);
        //     }
        //   }
        // }
      }
      
      console.log('Final agent reply:', finalReply);
      this.chatMessages.push(`Jana: ${finalReply}`);
    } catch (error) {
      console.error('Error sending chat to agent:', error);
      this.chatMessages.push("Jana: Error processing your message.");
    }
  }
  resetWizard() {
    // Set wizardFinished to false
    this.wizardConfigService.wizardFinished = false;
  
    // Update local storage as well if you are storing the wizard state there
    this.router.navigate(["/"]);
  }

  
  private initThree(): void {
    // 1) Create Renderer (pass the ViewChild canvas)
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvasRef.nativeElement,
      antialias: true,
    });
    this.renderer.setSize(800, 800);

    // Use #dad2d2 as a hex color (0xdad2d2)
    this.renderer.setClearColor(0xdad2d2, 1);
    
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdad2d2); 
  
    // 3) Create Camera
    this.camera = new THREE.PerspectiveCamera(45,1, 0.1, 1000);
    this.camera.position.set(6, 8, 14);
  
    // 4) OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.update();

    const vertexShaderSource = `
    vec3 mod289(vec3 x)
{
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x)
{
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x)
{
  return mod289(((x*34.0)+10.0)*x);
}

vec4 taylorInvSqrt(vec4 r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}

vec3 fade(vec3 t) {
  return t*t*t*(t*(t*6.0-15.0)+10.0);
}
  float pnoise(vec3 P, vec3 rep)
{
  vec3 Pi0 = mod(floor(P), rep); // Integer part, modulo period
  vec3 Pi1 = mod(Pi0 + vec3(1.0), rep); // Integer part + 1, mod period
  Pi0 = mod289(Pi0);
  Pi1 = mod289(Pi1);
  vec3 Pf0 = fract(P); // Fractional part for interpolation
  vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;

  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);

  vec4 gx0 = ixy0 * (1.0 / 7.0);
  vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);

  vec4 gx1 = ixy1 * (1.0 / 7.0);
  vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);

  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
  vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
  vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
  vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
  vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

  vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));

  float n000 = norm0.x * dot(g000, Pf0);
  float n010 = norm0.y * dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
  float n100 = norm0.z * dot(g100, vec3(Pf1.x, Pf0.yz));
  float n110 = norm0.w * dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = norm1.x * dot(g001, vec3(Pf0.xy, Pf1.z));
  float n011 = norm1.y * dot(g011, vec3(Pf0.x, Pf1.yz));
  float n101 = norm1.z * dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n111 = norm1.w * dot(g111, Pf1);

  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x); 
  return 2.2 * n_xyz;
}
  uniform float u_time;
  uniform float u_frequency;

    void main() {
        float noise = 3.0 * pnoise(position + u_time, vec3(10.0));
        float displacement = (u_frequency / 30.0)*(noise / 10.0);
        vec3 newPosition = position + normal * displacement;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
  `;
    const fragmentShaderSource = `
    uniform vec2 u_resolution;
    uniform float u_isRecording;
    void main() {
      vec2 st = gl_FragCoord.xy / u_resolution;
      vec4 normalColor = vec4(vec3(st.x, st.y, 1.0), 1.0);
      vec4 recordingColor = vec4(1.0, 0.435, 0.38, 1.0);
      gl_FragColor = mix(normalColor, recordingColor, u_isRecording);
}
  `;
  
    // 5) Match the shader IDs from the HTML
    const mat = new THREE.ShaderMaterial({
      wireframe: true,
      uniforms: this.uniforms,
      vertexShader: vertexShaderSource,
      fragmentShader: fragmentShaderSource,
    });
  
    // 6) Create geometry and add it to scene
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
    const geometry = new THREE.IcosahedronGeometry(4, 30);
    this.sphere = new THREE.Mesh(geometry, mat);
    this.scene.add(this.sphere);
    const listener = new THREE.AudioListener();
    this.camera.add(listener);

  
    // (Optional) Add lights if you want to see non-wireframe materials
    //const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    //this.scene.add(ambientLight);
  
    // ...
  }
  
  

  private onWindowResize() {
    // Keep a fixed size
    this.renderer.setSize(400, 400);
  
    this.camera.updateProjectionMatrix();
  }

  async playTts(textToSpeak: string, speakerId: string = 'af_bella') {
    // Ensure the speaker ID is valid
    const validSpeakers = [
        'af_bella', 'af_nicole', 'af_sarah',
        'am_adam', 'am_michael',
        'bf_emma', 'bf_isabella',
        'bm_george', 'bm_lewis'
    ];

    if (!validSpeakers.includes(speakerId)) {
        console.error(`Invalid speaker ID: ${speakerId}. Using default.`);
        speakerId = 'af_bella';  // Default to a known good voice
    }

    // Stop any currently playing sound
    if (this.currentSound && this.currentSound.isPlaying) {
        this.currentSound.stop();
        this.currentSound = undefined;
    }

    try {
        // 1) Fetch TTS audio with the corrected speaker ID
        const response = await fetch('http://localhost:5000/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: textToSpeak.trim(), speaker_id: speakerId }) 
        });

        if (!response.ok) {
            console.error('TTS request failed:', response.statusText);
            return;
        }

        // 2) Convert response to a WAV blob
        const audioBlob = await response.blob(); 
        const audioUrl = URL.createObjectURL(audioBlob); // Convert Blob to URL

        // 3) Load and play the audio in Three.js
        const listener = this.camera.children.find(child => child.type === 'AudioListener') as THREE.AudioListener;
        const sound = new THREE.Audio(listener);
        const audioLoader = new THREE.AudioLoader();

        this.currentSound = sound;
        audioLoader.load(
            audioUrl,
            (buffer: AudioBuffer) => {
                sound.setBuffer(buffer);
                sound.setLoop(false);
                sound.setVolume(0.5);
                sound.play();
                this.analyser = new THREE.AudioAnalyser(sound, 32);
            },
            undefined,
            (err) => console.error('Audio loading error:', err)
        );
    } catch (error) {
        console.error('Error calling TTS or playing audio:', error);
    }
}
  
  private startAnimationLoop(): void {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);
      
      // Update the time uniform
      this.uniforms['u_time'].value = this.clock.getElapsedTime();
      if (this.analyser) {
        const averageFrequency = this.analyser.getAverageFrequency();
        this.uniforms['u_frequency'].value = averageFrequency;
      }
      if (this.isWaitingForAgent) {
        const time = this.clock.getElapsedTime();
        // Adjust amplitude and speed as desired:
        const scaleFactor = 1 + 0.2 * Math.sin(time * 2.0);
        this.sphere.scale.set(scaleFactor, scaleFactor, scaleFactor);
      } else {
        // Otherwise, reset scale to normal.
        this.sphere.scale.set(1, 1, 1);
      }
      this.sphere.rotation.x += 0.01;
      this.sphere.rotation.z += 0.01;

      // Render
      this.renderer.render(this.scene, this.camera);
    };

    animate();
  }



  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];


  public startRecording() {
    this.isRecording = true;
    this.uniforms['u_isRecording'].value = 1.0;
    this.audioChunks = []; // clear previous
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        this.mediaRecorder = new MediaRecorder(stream);
        this.mediaRecorder.start();
        console.log('Recording started');

        this.mediaRecorder.addEventListener('dataavailable', (event) => {
          if (event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        });
      })
      .catch(error => {
        console.error('Failed to start recording:', error);
        this.isRecording = false; 
      });
  }


  public async stopRecording() {
    this.isRecording = false;
    this.uniforms['u_isRecording'].value = 0.0; 
    if (!this.mediaRecorder) {
        console.warn('No recording in progress.');
        return;
    }

    this.mediaRecorder.stop();
    console.log('Recording stopped');

    this.mediaRecorder.addEventListener('stop', async () => {
        try {
            // 1) Convert recorded chunks into a Blob (WAV format)
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
            console.log('Recorded audio blob size:', audioBlob.size);

            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.wav');

            // 2) Transcribe audio (Speech-to-Text)
            console.log("Sending recorded audio to transcription...");
            const sttResponse = await fetch('http://localhost:5000/transcribe', {
                method: 'POST',
                body: formData
            });

            if (!sttResponse.ok) {
                console.error('Transcription failed:', sttResponse.statusText);
                return;
            }

            const sttData = await sttResponse.json();
            let finalReply = sttData.transcription.trim();
            console.log('Transcribed text:', finalReply);

            // 3) Validate finalReply (Prevents Blob URL issues)
            if (!finalReply || finalReply.startsWith("blob:")) {
                console.error("TTS Error: finalReply is invalid. Got:", finalReply);
                return;
            }

            // 4) Send the transcribed text to the AI agent
            this.isWaitingForAgent = true;

            const agentResponse = await fetch('http://localhost:8000/run_task', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream'
                },
                body: JSON.stringify({ task: finalReply })
            });

            if (!agentResponse.ok) {
                console.error('Agent request failed:', agentResponse.statusText);
                this.isWaitingForAgent = false;
                return;
            }

            // 5) Read SSE response from the AI agent
            const reader = agentResponse.body?.getReader();
            if (!reader) {
                console.error('Failed to get response reader.');
                this.isWaitingForAgent = false;
                return;
            }

            const decoder = new TextDecoder();
            finalReply = ""; // Reset before processing

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunkText = decoder.decode(value, { stream: true });
                console.log('Received SSE chunk:', chunkText);

                const lines = chunkText.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const message = JSON.parse(line.slice(6).trim());

                            if (message.type === 'Result') {
                                finalReply = message.message.trim();
                                console.log('Final AI response:', finalReply);
                            }

                            if (message.status === 'completed') {
                                console.log('SSE processing completed.');
                                await reader.cancel();
                                break;
                            }
                        } catch (err) {
                            console.error('Error parsing SSE data:', err);
                        }
                    }
                }
            }

            this.isWaitingForAgent = false;

            // 6) Validate finalReply (Prevent empty responses)
            if (!finalReply) {
                console.error("TTS Error: AI response is empty. Not sending to TTS.");
                return;
            }

            // 7) Play the TTS audio (ONLY ONCE)
            console.log("Final reply is valid. Sending to playTts():", finalReply);
            this.playTts(finalReply, "af_bella");

        } catch (error) {
            console.error('Error in STT -> AI -> TTS flow:', error);
            this.isWaitingForAgent = false;
        }
    });

    this.mediaRecorder = null;
}



} // END of JanaComponent
