import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { WizardConfigService } from '../wizard-config.service';
import { FormsModule } from '@angular/forms';
import hljs from 'highlight.js';
import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp, startAfter, Timestamp, where } from 'firebase/firestore';
import { AppModule } from '../app.module';
import { AuthService } from '../auth.service';
declare var bootstrap: any;

export interface SavedWidget {
  title: string;
  messages: ChatMessage[];
  
}
export interface SavedWidget {
  title: string;
  messages: ChatMessage[];
  savedAt?: any;        // Firestore Timestamp (serverTimestamp())
  localSavedAt?: Date;  // A client-side timestamp for immediate UI display
}


@Component({
  selector: 'app-jana',
  standalone: false,
  templateUrl: './jana.component.html',
  styleUrl: './jana.component.css'
})
export class JanaComponent implements OnInit, AfterViewInit, OnDestroy  {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('rightSidenav') rightSidenav!: ElementRef;
  public showLoadMoreButton: boolean = false;
  private currentSound?: THREE.Audio;
  public isRecording = false;
  public isWaitingForAgent = false;
  public canLoadMore: boolean = false;

  public chatTitle: string = ''; // Holds the title from the modal
  @ViewChild('titleModalRef') titleModalRef!: ElementRef;
  constructor(
    public wizardConfigService: WizardConfigService,
    private router: Router,private authService: AuthService
  ) {}



  
  public isLoading: boolean = false;
    // For pagination: stores the last document from the last batch
  private lastChatDoc: any = null;  
    // Number of chats to load in each batch
  private batchSize: number = 30;  

  

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
  };  public savedWidgets: SavedWidget[] = [];

  /** 
   * Flag to detect if we're dealing with a short clip. 
   * (For an extra visual "boost") 
   */
  private isShortClip = false;
  public chatMessages: ChatMessage[] = [];
  
  public newChatMessage: string = '';

  currentUser: any = null;

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user && user.uid) {
        // Reset pagination marker for a fresh load
        this.lastChatDoc = null;
        this.savedWidgets = [];
        // Load the first batch of chats (today and older together)
        this.loadWidgetsBatch(user.uid);
      } else {
        this.savedWidgets = [];
      }
    });
  }
  
  
  

  ngAfterViewInit(): void {
    this.initThree();
    this.startAnimationLoop();
  }
  ngAfterViewChecked(): void {
    // This will run after every change detection cycle
    hljs.highlightAll();
  }

  ngOnDestroy(): void {
    // Clean up the animation loop
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }
  sendChatMessage() {
    if (this.newChatMessage.trim()) {
      this.chatMessages.push({ sender: 'user', content: this.newChatMessage });
      // Instead of simulating a response, call the agent:
      this.sendToAgent(this.newChatMessage);
      this.newChatMessage = '';
    }
  }

  


  async saveChatWithModal(): Promise<void> {
    if (!this.currentUser || !this.currentUser.uid) {
      console.error('User not logged in');
      return;
    }
  
    // Make a deep copy of the chat messages
    const messagesCopy = this.chatMessages.map(msg => ({ ...msg }));
    // Use the entered chat title or fall back to a default
    const title = this.chatTitle.trim() || `Chat saved on ${new Date().toLocaleString()}`;
    // Create a local timestamp for immediate UI display
    const localTimestamp = new Date();
  
    // Create chat data; note that serverTimestamp() will be filled later by Firestore
    const chatData: SavedWidget = {
      title,
      messages: messagesCopy,
      savedAt: serverTimestamp(),  // This is only a sentinel until you re-fetch from Firestore
      localSavedAt: localTimestamp // Use this immediately in the UI for grouping
    };
  
    try {
      // Save the chat to Firestore under the user's "chats" subcollection
      const userChatsCollection = collection(AppModule.db, 'users', this.currentUser.uid, 'chats');
      await addDoc(userChatsCollection, chatData);
      console.log('Chat saved successfully for user:', this.currentUser.uid);
      
      // Immediately update local UI arrays:
      this.savedWidgets.push(chatData);
      this.groupChatsByDay();
    } catch (error) {
      console.error('Error saving chat:', error);
    }
  
    // Programmatically close the modal
    const modalEl = this.titleModalRef.nativeElement;
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) {
      modalInstance.hide();
    }
  
    // Clear the chatTitle for the next save
    this.chatTitle = '';
  }

  onScroll(event: any): void {
    const element = event.target;
    const threshold = 50; // When 50px from the bottom
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - threshold) {
      // Only call if a user is logged in and there might be more to load
      if (this.currentUser && this.currentUser.uid) {
        this.loadWidgetsBatch(this.currentUser.uid);
      }
    }
  }
  
  
  public groupedWidgets: { [label: string]: SavedWidget[] } = {};
  private groupChatsByDay(): void {
    this.groupedWidgets = {};
    for (const widget of this.savedWidgets) {
      // Log out the computed label for each widget.
      const label = this.getDayLabel(widget.savedAt, widget.localSavedAt);
      console.log('Widget title:', widget.title, 'Group label:', label);
      if (!this.groupedWidgets[label]) {
        this.groupedWidgets[label] = [];
      }
      this.groupedWidgets[label].push(widget);
    }
    console.log("Grouped Widgets:", this.groupedWidgets);
  }
  
  private getDayLabel(timestamp: any, localTimestamp?: Date): string {
    let dateObj: Date | null = null;
  
    if (timestamp && typeof timestamp === 'string') {
      dateObj = new Date(timestamp);
    } else if (timestamp && typeof timestamp === 'object' && timestamp.toDate) {
      dateObj = timestamp.toDate();
    } else if (localTimestamp) {
      dateObj = localTimestamp;
    }
  
    if (!dateObj || isNaN(dateObj.getTime())) {
      return 'No Date';
    }
  
    const now = new Date();
    // Adjust according to your desired grouping method (local or UTC)
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const chatDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    const diffInMs = startOfToday.getTime() - chatDay.getTime();
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
  
    if (diffInDays === 0) {
      return 'Today';
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays > 1 && diffInDays <= 7) {
      return 'Previous 7 Days';
    } else {
      return 'Older';
    }
  }
  
  
  


  public getGroupLabels(): string[] {
    const labels = Object.keys(this.groupedWidgets);
    const customOrder: { [key: string]: number } = {
      'Today': 1,
      'Yesterday': 2,
      'Previous 7 Days': 3,
      'Older': 4,
      'No Date': 99
    };
  
    return labels.sort((a, b) => {
      // If a label isn’t defined, give it a high value
      const orderA = customOrder[a] || 100;
      const orderB = customOrder[b] || 100;
      return orderA - orderB;
    });
  }
  



  
  
  
  

  loadWidget(widget: SavedWidget): void {
    // Optionally, clear current chat messages first:
    this.chatMessages = [];
  
    // Push each saved message back into the chatMessages array
    widget.messages.forEach(msg => {
      this.chatMessages.push({ ...msg });
    });
  }

  async loadWidgetsBatch(uid: string): Promise<void> {
    try {
      const chatsCollectionRef = collection(AppModule.db, 'users', uid, 'chats');
      let q;
      if (this.lastChatDoc) {
        q = query(
          chatsCollectionRef,
          orderBy('savedAt', 'desc'),
          startAfter(this.lastChatDoc),
          limit(this.batchSize)
        );
      } else {
        q = query(
          chatsCollectionRef,
          orderBy('savedAt', 'desc'),
          limit(this.batchSize)
        );
      }
  
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        // Update your pagination marker with the last document
        this.lastChatDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        
        // Set canLoadMore flag: if we got the full batch, assume there are more chats available.
        this.canLoadMore = (querySnapshot.size === this.batchSize);
  
        const newWidgets = querySnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            title: data['title'],
            messages: data['messages'],
            savedAt: data['savedAt']
          } as SavedWidget;
        });
  
        console.log("New Widgets Batch:", newWidgets);
        this.savedWidgets.push(...newWidgets);
        this.groupChatsByDay();
      } else {
        console.log("No more chats to load.");
        this.canLoadMore = false;
      }
    } catch (error) {
      console.error('Error fetching saved chat widgets:', error);
    }
  }
  
  

  
  
  
  
  
  
  
  

  

  adjustTextareaHeight(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    // Reset the height to auto to correctly calculate new scrollHeight
    textarea.style.height = 'auto';
    // Set the textarea height to match its scrollHeight, ensuring it expands with the text
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  public loadingMessages: string[] = [
    "Jana is processing your request...",
    "Please hold on—Jana is working on your answer.",
    "Jana is thinking—one moment please.",
    "Just a moment; Jana is gathering the information.",
    "Jana is on it, please stand by."
  ];
  
  public loadingText: string = "";
  
  // A helper to get a random message:
  getRandomLoadingMessage(): string {
    const index = Math.floor(Math.random() * this.loadingMessages.length);
    return this.loadingMessages[index];
  }


  handleEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (!keyboardEvent.shiftKey) {
      keyboardEvent.preventDefault(); // Prevent insertion of newline.
      this.sendChatMessage();
    }
  }
  private processMarkdown(text: string): string {
    // Replace escaped newline characters with actual newlines (if needed)
    let processedText = text.replace(/\\n/g, "\n");
  
    // Replace newlines with <br> tags to create HTML line breaks.
    processedText = processedText.replace(/\n/g, "<br>");
  
    // Convert headings (for h1, h2, h3)
    processedText = processedText.replace(/^###(.*)$/gm, "<h3>$1</h3>");
    processedText = processedText.replace(/^##(.*)$/gm, "<h2>$1</h2>");
    processedText = processedText.replace(/^#(.*)$/gm, "<h1>$1</h1>");
  
    // Convert **bold** text to <strong>
    processedText = processedText.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  
    // Convert *italic* text to <em>
    processedText = processedText.replace(/\*(.*?)\*/g, "<em>$1</em>");
  
    // You can add more replacements for additional markdown elements as needed.
    
    return processedText;
  }
  
  

  
  async sendToAgent(text: string) {
    // Set loading state to true so the UI can show the typing indicator
    this.isLoading = true;
    this.loadingText = this.getRandomLoadingMessage();
    
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
        this.chatMessages.push({ sender: 'ai', content: "Jana: Agent request failed." });
        this.isLoading = false;
        return;
      }
      
      const reader = agentResponse.body?.getReader();
      if (!reader) {
        console.error('No reader available for agentResponse');
        this.chatMessages.push({ sender: 'ai', content: "Jana: No agent response available." });
        this.isLoading = false;
        return;
      }
      
      const decoder = new TextDecoder();
      let finalReply = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunkText = decoder.decode(value, { stream: true });
        console.log('SSE chunk from agent:', chunkText);
        finalReply = chunkText; 
      }
      
      console.log('Final agent reply:', finalReply);
      
      // Optional: process the final reply if it's JSON or contains code fences.
      try {
        finalReply = JSON.parse(finalReply);
      } catch (error) {
        console.error("Error parsing final reply as JSON:", error);
      }
      
      if (finalReply.startsWith('```markdown')) {
        finalReply = finalReply.replace(/^```markdown\s*/, '').replace(/\s*```$/, '');
      }
      console.log(finalReply);
      
      // Push the final agent reply into the chat
      this.chatMessages.push({ sender: 'ai', content: finalReply });
      
    } catch (error) {
      console.error('Error sending chat to agent:', error);
      this.chatMessages.push({ sender: 'ai', content: "Error processing your message." });
    } finally {
      // In any case, turn off the loading indicator.
      this.isLoading = false;
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
    this.renderer.setSize(400, 400);
    this.renderer.setClearColor(0x000000, 1); // Set clear color to black
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
  
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
            }
            ,
            undefined,
            (err) => console.error('Audio loading error:', err)
        );
        this.chatMessages.push({ sender: 'ai', content: textToSpeak });
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

export interface ChatMessage {
  sender: 'user' | 'ai';
  content: string;
}
