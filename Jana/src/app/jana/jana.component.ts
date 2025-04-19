import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { WizardConfigService } from '../wizard-config.service';
import { FormsModule } from '@angular/forms';
import hljs from 'highlight.js';
import { addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, startAfter, Timestamp, where } from 'firebase/firestore';
import { AppModule } from '../app.module';
import { AuthService } from '../auth.service';
import { invoke } from '@tauri-apps/api/core';
declare var bootstrap: any;

export interface SavedWidget {
  title: string;
  messages: ChatMessage[];
  
}
export interface SavedWidget {
  id?: string;          // Added widget (document) id from Firestore
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
  private autoRestartMic = true;

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
  private isListening = false;

  

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
  private analyserNode!: AnalyserNode;
  private silenceTimer: number | null = null;

  /** 
   * Flag to detect if we're dealing with a short clip. 
   * (For an extra visual "boost") 
   */
  private isShortClip = false;
  public chatMessages: ChatMessage[] = [];
  
  public newChatMessage: string = '';

  currentUser: any = null;

  ngOnInit() {
    // Attempt to load the saved chat messages using Tauri storage.
    invoke<string>('get_local_storage', { key: 'chatMessages' })
      .then((chatDataStr: string | null) => {
        if (chatDataStr) {
          try {
            this.chatMessages = JSON.parse(chatDataStr);
            console.log('Restored chat messages from Tauri storage:', this.chatMessages);
          } catch (error) {
            console.error('Error parsing chat messages from Tauri storage', error);
            this.chatMessages = [];
          }
        } else {
          this.chatMessages = [];
        }
      })
      .catch(err => {
        console.error('Error reading chat messages from Tauri storage:', err);
        this.chatMessages = [];
      });

        // Also restore the selected chat id from local storage
  invoke<string>('get_local_storage', { key: 'currentWidgetId' })
  .then((savedId: string | null) => {
    if (savedId && savedId.trim().length > 0) {
      this.currentWidgetId = savedId;
      console.log('Restored current widget id from local storage:', this.currentWidgetId);
    }
  })
  .catch(err => {
    console.error('Error restoring currentWidgetId from Tauri storage:', err);
  });
      
    // Also load user info and saved widgets, as needed
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user && user.uid) {
        this.lastChatDoc = null;
        this.savedWidgets = [];
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

  async createNewWidgetIfNeeded(firstMessage: string): Promise<void> {
    if (!this.currentUser || !this.currentUser.uid) {
      console.error('User not logged in.');
      return Promise.reject('User not logged in');
    }
    if (this.currentWidgetId) {
      // Widget already exists; nothing to do
      return;
    }
    
    const title = firstMessage.trim().slice(0, 50);
    const widgetData: SavedWidget = {
      title,
      messages: this.chatMessages,
      savedAt: serverTimestamp(),
      localSavedAt: new Date()
    };
    const userChatsCollection = collection(AppModule.db, 'users', this.currentUser.uid, 'chats');
  
    try {
      const docRef = await addDoc(userChatsCollection, widgetData);
  
      // 1) Store the new ID in your component state
      this.currentWidgetId = docRef.id;
      console.log('New widget created with ID:', this.currentWidgetId);
  
      // 2) Persist it to Tauri local storage
      this.persistSelectedChatId();
  
      // 3) Update the UI lists
      this.savedWidgets.unshift({ ...widgetData, id: this.currentWidgetId });
      this.groupChatsByDay();
  
      console.log('Updated savedWidgets:', this.savedWidgets);
      console.log('Grouped widgets:', this.groupedWidgets);
  
    } catch (err) {
      console.error('Error creating new widget:', err);
      return Promise.reject(err);
    }
  }
  
  
  sendChatMessage(): void {
    if (!this.newChatMessage.trim()) return;
  
    // Clear old widget if this is the first message of a new chat
    if (this.chatMessages.length === 0 && this.currentWidgetId) {
      this.clearSelectedChatId();
    }
  
    // 1) Capture the new message, but don't mutate chatMessages yet
    const newMsg: ChatMessage = {
      sender: 'user',
      content: this.newChatMessage.trim()
    };
  
    // 2) Clone the *existing* history (before the new turn)
    const historyOnly = [...this.chatMessages];
  
    // 3) Build your payload: history without the new turn, plus the new turn
    const payload = {
      history: historyOnly,           // previous conversation only
      newMessage: newMsg.content      // the new user text
    };
    console.log('Sending payload:', payload);
  
    // 4) Now append the new message into this.chatMessages so UI updates
    this.chatMessages.push(newMsg);
  
    const afterSave = () => {
      this.sendToAgent(payload);
      this.persistActiveWidgetToFirebase();
      this.persistChatMessages();
    };
  
    if (!this.currentWidgetId) {
      this.createNewWidgetIfNeeded(newMsg.content)
        .then(afterSave)
        .catch(err => console.error(err));
    } else {
      afterSave();
    }
  
    this.newChatMessage = '';
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

  persistChatMessages(): void {
    try {
      const chatData = JSON.stringify(this.chatMessages);
      invoke('set_local_storage', { key: 'chatMessages', value: chatData })
        .then(() => {
          console.log('Chat messages saved via Tauri storage');
        })
        .catch((err: any) => {
          console.error('Error saving chat messages to Tauri storage', err);
        });
    } catch (e) {
      console.error('Error stringifying chat messages', e);
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
  

  persistActiveWidgetToFirebase(): void {
    if (!this.currentUser || !this.currentUser.uid) {
      console.error('Cannot update chat: user not logged in.');
      return;
    }
    if (!this.currentWidgetId) {
      console.warn('No active widget ID found; chat not saved to Firebase.');
      return;
    }
    
    console.log(`Updating widget ${this.currentWidgetId} with messages:`, this.chatMessages);
    
    // Reference the active widget document.
    const widgetDocRef = doc(AppModule.db, 'users', this.currentUser.uid, 'chats', this.currentWidgetId);
    const updatedData = {
      messages: this.chatMessages,
      updatedAt: serverTimestamp()  // Update the last updated time
    };
  
    setDoc(widgetDocRef, updatedData, { merge: true })
      .then(() => {
        console.log('Active widget chat auto-updated in Firestore.');
      })
      .catch(err => {
        console.error('Error auto-updating chat in Firestore:', err);
      });
  }
  
  
  



  
  
  refreshChats(): void {
    if (!this.currentUser || !this.currentUser.uid) {
      console.warn('No user logged in, cannot refresh chats.');
      return;
    }
    // Optionally reset pagination to fetch from the beginning
    this.lastChatDoc = null;
    this.savedWidgets = [];
  
    this.loadWidgetsBatch(this.currentUser.uid)
      .then(() => {
        console.log('Chats refreshed successfully.');
      })
      .catch(error => {
        console.error('Error refreshing chats:', error);
      });
  }
  
  

  public currentWidgetId: string | null = null;
  loadWidget(widget: SavedWidget): void {
    console.log('Loading widget:', widget);
    
    // Clear the current chat messages
    this.chatMessages = [];
    
    // Update the current widget id if available
    if (widget.id) {
      this.currentWidgetId = widget.id;
      console.log('Current widget id set to:', this.currentWidgetId);
      // Persist the selected chat id to local storage
      this.persistSelectedChatId();
    } else {
      console.warn('Widget has no id, setting currentWidgetId to null');
      this.currentWidgetId = null;
      // Remove it from storage if necessary
      this.persistSelectedChatId();
    }
    
    // Load widget messages
    widget.messages.forEach(msg => {
      this.chatMessages.push({ ...msg });
    });
    this.persistChatMessages();
  
    // Optionally, refresh the list to verify newest updates
    this.refreshChats();
  }

  persistSelectedChatId(): void {
    try {
      // Use Tauri's storage method to save the current widget id
      invoke('set_local_storage', { key: 'currentWidgetId', value: this.currentWidgetId || '' })
        .then(() => console.log('Selected chat id saved to local storage'))
        .catch((err: any) => console.error('Error saving currentWidgetId:', err));
    } catch (e) {
      console.error('Error in persistSelectedChatId:', e);
    }
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
            id: docSnap.id,  // Save the document's id here
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

  public searchTerm: string = '';
public filteredSearchResults: SavedWidget[] = [];

// Called when user types in the search input
applyWidgetSearch(): void {
  if (!this.searchTerm || this.searchTerm.trim().length === 0) {
    // No search term: clear the results
    this.filteredSearchResults = [];
    return;
  }

  const term = this.searchTerm.toLowerCase();

  // Flatten all widgets from groupedWidgets, or use savedWidgets directly
  // If you prefer searching among all savedWidgets (not grouped), just do:
  // this.filteredSearchResults = this.savedWidgets.filter( ... );
  
  // Flatten grouped widgets
  const allWidgets: SavedWidget[] = [];
  for (const groupLabel of Object.keys(this.groupedWidgets)) {
    allWidgets.push(...this.groupedWidgets[groupLabel]);
  }

  // Filter by title
  this.filteredSearchResults = allWidgets.filter(widget =>
    widget.title.toLowerCase().includes(term)
  );
}

// Called when user clicks a search result in the modal
openWidget(widget: SavedWidget): void {
  // If you want to close the modal:
  const modalEl = document.getElementById('searchModal');
  if (modalEl) {
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) {
      modalInstance.hide();
    }
  }

  // Clear current chat messages if that’s your logic:
  this.chatMessages = [];

  // Load this widget's messages
  widget.messages.forEach(msg => {
    this.chatMessages.push({ ...msg });
  });

  // Optionally persist new chatMessages
  this.persistChatMessages();
  
  console.log('Opened widget:', widget.title);
}

public getWidgetsByLabel(label: string): SavedWidget[] {
  // If you use groupedWidgets:
  return this.groupedWidgets[label] || [];
}

public startNewChat(): void {
  // Close the modal (if you like):
  const modalEl = document.getElementById('searchChatsModal');
  if (modalEl) {
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) {
      modalInstance.hide();
    }
  }
  // Clear existing chat:
  this.chatMessages = [];
  this.clearSelectedChatId();
  // Optionally, persist:
  this.persistChatMessages();
}

clearChatMessages(): void {
  // 1) Clear in-memory chat messages
  this.chatMessages = [];

  // 2) Persist the new (empty) state to Tauri
  this.clearSelectedChatId();
  this.persistChatMessages();
  
  console.log('All chat messages cleared.');
}


clearSelectedChatId(): void {
  this.currentWidgetId = null;
  invoke('set_local_storage', { key: 'currentWidgetId', value: '' })
    .catch(err => console.error('Error clearing widgetId:', err));
}


  
  

  
  // 2) Change sendToAgent to accept that payload object
async sendToAgent(payload: {history: ChatMessage[];newMessage: string;}) {
  this.isLoading = true;
  this.loadingText = this.getRandomLoadingMessage();

  try {
    const agentResponse = await fetch('http://localhost:8000/run_task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task:      payload.newMessage,  // <— required by your API
        history:   payload.history      // <— your extra context
      }),
    });

    if (!agentResponse.ok) {
      console.error('Agent request failed', agentResponse.statusText);
      this.chatMessages.push({ sender: 'ai', content: "Jana: Agent request failed." });
      return;
    }

    const reader = agentResponse.body?.getReader();
    if (!reader) {
      console.error('No reader available for agentResponse');
      this.chatMessages.push({ sender: 'ai', content: "Jana: No agent response available." });
      return;
    }

    const decoder = new TextDecoder();
    let finalReply = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      finalReply = decoder.decode(value, { stream: true });
    }

    // parse JSON if needed
    try {
      finalReply = JSON.parse(finalReply);
    } catch { /* not JSON, ignore */ }

    // strip markdown fences, etc.
    if (finalReply.startsWith('```')) {
      finalReply = finalReply.replace(/```[^\n]*\n?/, '').replace(/```$/, '');
    }

    // push AI reply
    this.chatMessages.push({ sender: 'ai', content: finalReply });
    this.persistActiveWidgetToFirebase();
    this.persistChatMessages();

  } catch (error) {
    console.error('Error sending chat to agent:', error);
    this.chatMessages.push({ sender: 'ai', content: "Error processing your message." });
  } finally {
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

  private normalizeAcronyms(text: string): string {
    const map: Record<string, string> = {
      // Networking & Internet
      "aren't":    "are not",
    "can't":     "cannot",
    "couldn't":  "could not",
    "didn't":    "did not",
    "doesn't":   "does not",
    "don't":     "do not",
    "hadn't":    "had not",
    "hasn't":    "has not",
    "haven't":   "have not",
    "he'd":      "he would",
    "he'll":     "he will",
    "he's":      "he is",
    "i'd":       "I would",
    "i'll":      "I will",
    "i'm":       "I am",
    "i've":      "I have",
    "isn't":     "is not",
    "it's":      "it is",
    "let's":     "let us",
    "mightn't":  "might not",
    "mustn't":   "must not",
    "shan't":    "shall not",
    "she'd":     "she would",
    "she'll":    "she will",
    "she's":     "she is",
    "shouldn't": "should not",
    "that's":    "that is",
    "there's":   "there is",
    "they'd":    "they would",
    "they'll":   "they will",
    "they're":   "they are",
    "they've":   "they have",
    "we'd":      "we would",
    "we're":     "we are",
    "we've":     "we have",
    "weren't":   "were not",
    "what'll":   "what will",
    "what're":   "what are",
    "what's":    "what is",
    "what've":   "what have",
    "where's":   "where is",
    "who'd":     "who would",
    "who'll":    "who will",
    "who're":    "who are",
    "who's":     "who is",
    "who've":    "who have",
    "won't":     "will not",
    "wouldn't":  "would not",
    "you'd":     "you would",
    "you'll":    "you will",
    "you're":    "you are",
    "you've":    "you have",
    "o'clock":   "o clock",
    "y'all":     "you all",
    "y'all'd've":"you all would have",
      'ARP':    'arp',
      'BGP':    'bee‑gee‑pee',
      'CIDR':   'sigh‑der',
      'DHCP':   'dee‑h‑see‑pee',
      'DNS':    'dee‑en‑ess',
      'DNSSEC': 'dee‑en‑ess‑sek',
      'HTTP':   'aitch‑tee‑tee‑pee',
      'HTTPS':  'aitch‑tee‑tee‑pee‑ess',
      'ICMP':   'eye‑see‑em‑pee',
      'IP':     'eye‑pee',
      'IPSEC':  'eye‑pee‑ess‑e‑see',
      'LAN':    'lan',
      'MAC':    'mack',
      'MPLS':   'em‑pee‑ell‑ess',
      'NAT':    'nat',
      'NTP':    'en‑tee‑pee',
      'OSI':    'oh‑ess‑eye',
      'PAN':    'pan',
      'PPP':    'pee‑pee‑pee',
      'POP3':   'pop three',
      'RADIUS': 'ray‑dee‑us',
      'RFC':    'are‑eff‑see',
      'SMTP':   'ess‑em‑tee‑pee',
      'SNMP':   'ess‑en‑em‑pee',
      'SSH':    'ess‑ess‑aitch',
      'TCP':    'tee‑see‑pee',
      'TLS':    'tee‑ell‑ess',
      'TTL':    'tee‑tee‑ell',
      'UDP':    'you‑dee‑pee',
      'VLAN':   'v‑lan',
      'VPN':    'vee‑pee‑en',
      'WLAN':   'double‑you‑lan',
  
      // CS / Dev
      'API':    'ay‑pee‑eye',
      'ASCII':  'ask‑ee',
      'AWS':    'ay‑double‑you‑ess',
      'CRUD':   'crud',
      'CPU':    'see‑pee‑you',
      'CSS':    'see‑ess‑ess',
      'DB':     'database',
      'DBMS':   'dee‑bee‑em‑ess',
      'DOM':    'dom',
      'DOS':    'doss',
      'ERP':    'ee‑are‑pee',
      'FTP':    'eff‑tee‑pee',
      'GPU':    'gee‑pee‑you',
      'GUI':    'goo‑ey',
      'HTML':   'aitch‑tee‑em‑ell',
      'IDE':    'eye‑dee‑ee',
      'IoT':    'eye‑oh‑tee',
      'JSON':   'jay‑son',
      'JS':     'jay‑ess',
      'JVM':    'jay‑vee‑em',
      'KPI':    'kay‑pee‑eye',
      'LDAP':   'ell‑dee‑ay‑pee',
      'MVC':    'em‑vee‑see',
      'OOP':    'oh‑oh‑pee',
      'ORM':    'oh‑are‑em',
      'OS':     'oh‑ess',
      'PHP':    'pee‑aitch‑pee',
      'REST':   'rest',
      'RPC':    'are‑pee‑cee',
      'SaaS':   'sass',
      'SDK':    'ess‑dee‑kay',
      'SQL':    'sequel',
      'SVG':    'ess‑vee‑gee',
      'NoSQL': 'no‑sequel',
      'UI':     'you‑eye',
      'UML':    'you‑em‑ell',
      'URL':    'you‑are‑ell',
      'UX':     'you‑ex',
      'VM':     'vee‑em',
      'XML':    'ex‑em‑ell',
      'YAML':   'yah‑mel',
  
      // Security
      'APT':    'ay‑pee‑tee',
      'CVE':    'see‑vee‑ee',
      'CVSS':   'see‑vee‑ess‑ess',
      'CSRF':   'sea‑ess‑arr‑eff',
      'DDoS':   'dee‑dos',
      'EDR':    'ee‑dee‑are',
      'IAM':    'eye‑ay‑em',
      'MITM':   'mit‑em',
      'MITRE':  'my‑tree',
      'OWASP':  'oh‑w‑asp',
      'PCI':    'pee‑cee‑eye',
      'PDfS':   'p‑dee‑eff‑ess',
      'PKI':    'pee‑kay‑eye',
      'RSA':    'are‑ess‑ay',
      'SIEM':   'seem',
      'SSL':    'ess‑ess‑ell',
      'WAF':    'wahff',
      'XSS':    'ex‑ess‑ess',
  
      // Common Latin / Abbrev
      'E\\.g\\.': 'for example',
      'I\\.e\\.': 'that is',
      'Etc\\.':   'et cetera',
      'vs\\.':    'versus',
      'a\\.m\\.': 'a‑em',
      'p\\.m\\.': 'pee‑em',
  
      // Misc
      'FAQ':    'fak',
      'DIY':    'dee‑eye‑why',
      'RSVP':   'are‑ess‑vee‑pee',
      'NASA':   'nasa',
      'UNICEF': 'you‑ne‑ice‑eff'
    };
  
    // Build a regex that matches *only* the keys in our map:
    const escKeys = Object.keys(map)
      .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(?<!\\w)(${escKeys.join('|')})(?!\\w)`, 'g');
  
    return text.replace(regex, match => {
      // first try exact key (for acronyms)
      if (map[match]) return map[match];
      // then lowercase (for contractions)
      const lower = match.toLowerCase();
      return map[lower] ?? match;
    });
  }
  

  private prepareSpeechText(markdown: string): string {
    let text = markdown;

    text = this.normalizeAcronyms(text);
  
    // 1) Remove fenced code blocks
    text = text.replace(/```[\s\S]*?```/g, "");
  
    // 2) Remove all table rows
    text = text.replace(/(^\|.*\|\s*(\r?\n|$))+/gm, "");
  
    // 3) Strip inline code backticks, bold and italic markers
    text = text
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1");
  
    // 4) Strip leading hashes from headings
    text = text.replace(/^#+\s*(.*)$/gm, "$1");
  
    // 5) Convert bullet lists into comma‑separated phrases
    text = text.replace(/^[-*]\s+(.*)$/gm, (_m, item) => `${item.trim()},`);
  
    // 6) Collapse multiple newlines into a single pause
    text = text.replace(/\n{2,}/g, ". ").replace(/\n/g, ", ");
  
    // ⬇ NEW: Remove stray hyphens, slashes and quotes ⬇
    text = text
      // remove any dash/slash characters
      .replace(/[-\/]/g, " ")
      // remove straight and “smart” quotes
      .replace(/['"`“”‘’]/g, "");
  
    // 7) Trim and ensure it ends with a period
    text = text
      .trim()
      .replace(/,+$/, "")
      .replace(/\.?$/, ".");
  
    // 8) If there was a table originally, tuck in a short cue
    if (/^\|.*\|/m.test(markdown)) {
      text += " I’ve added the table for you to see.";
    }

    if (/```/.test(markdown)) {
      text += " I’ve added the code snippet for you to see.";
    }

    if (/```/.test(markdown) && /^\|.*\|/m.test(markdown))
      text += "I’ve added the code snippet and the table for you to0.";
    


  
    return text;
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
                (sound as any).source.onended = () => {
                  this.currentSound = undefined;
                  if (this.autoRestartMic) {
                    console.log('TTS finished → restarting mic');
                    this.startRecording();
                  }
                };
                
            }
            ,
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

  public interruptEverything(): void {
    let interrupted = false;
  
    // Stop TTS if it's playing
    if (this.currentSound && this.currentSound.isPlaying) {
      this.currentSound.stop();
      this.currentSound = undefined;
      console.log("🔇 TTS playback interrupted.");
      interrupted = true;
    }
  
    // Stop agent loading
    if (this.isWaitingForAgent) {
      this.isWaitingForAgent = false;
      console.log("⏳ Agent loading interrupted.");
      interrupted = true;
    }
  
    // Stop recording if active
    if (this.isRecording || this.isListening) {
      this.stopListening();
      console.log("🎙️ Recording interrupted.");
      interrupted = true;
    }
  
    // If anything was interrupted, start recording again
    if (interrupted) {
      setTimeout(() => this.startRecording(), 300); // slight delay for cleanup
    }
  }
  
  

  public startRecording() {
    if (this.currentSound || this.isWaitingForAgent) {
      console.log("❌ Cannot start recording — TTS or agent is still active.");
      return;
    }
    this.isListening = true;  
    this.isRecording = true;
    this.uniforms['u_isRecording'].value = 1.0;
    this.audioChunks = [];
  
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        // ------- MediaRecorder -------
        this.mediaRecorder = new MediaRecorder(stream);
        this.mediaRecorder.start();
        console.log('Recording started');
  
        // ------- WebAudio setup -------
        const audioCtx = new AudioContext();
        // if the context is suspended (autoplay policies), resume it:
        if (audioCtx.state === 'suspended') audioCtx.resume();
  
        const source = audioCtx.createMediaStreamSource(stream);
        this.analyserNode = audioCtx.createAnalyser();
        // use a smaller FFT size to speed up:
        this.analyserNode.fftSize = 1024;
        source.connect(this.analyserNode);
  
        // pre‑allocate your buffer based on the analyser’s fftSize:
        this.dataArray = new Uint8Array(this.analyserNode.fftSize);
  
        // clear any old timer just in case:
        if (this.silenceTimer !== null) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
  
        // start watching for silence:
        this.watchForSilence();
  
        // ------- keep collecting chunks -------
        this.mediaRecorder.addEventListener('dataavailable', ev => {
          if (ev.data.size > 0) this.audioChunks.push(ev.data);
        });
      })
      .catch(err => {
        console.error('Failed to start recording:', err);
        this.isRecording = false;
      });
  }

  public stopListening() {
    this.autoRestartMic = false;
    this.isListening = false;
    if (this.silenceTimer !== null) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
  }

  private watchForSilence() {
    const SILENCE_THRESHOLD = 0.02;
    const SILENCE_DURATION  = 3000;

    const check = () => {
      // if someone else cancelled listening, bail out
      if (!this.isListening) return;

      // read mic volume…
      this.analyserNode.getByteTimeDomainData(this.dataArray);
      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        const v = (this.dataArray[i] / 128) - 1;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / this.dataArray.length);

      if (rms < SILENCE_THRESHOLD) {
        if (this.silenceTimer === null) {
          this.silenceTimer = window.setTimeout(() => {
            this.silenceTimer = null;
            if (this.isListening && this.mediaRecorder?.state === 'recording') {
              console.log('Silence → stopRecording()');
              this.stopRecording();
            }
          }, SILENCE_DURATION);
        }
      } else {
        if (this.silenceTimer !== null) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
      }

      // continue polling only if still listening
      if (this.isListening && this.mediaRecorder?.state === 'recording') {
        requestAnimationFrame(check);
      }
    };

    requestAnimationFrame(check);
  }
  


  public async stopRecording() {
    this.isListening = false;
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
    
        // 2) Transcribe audio (Speech-to-Text)
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.wav');
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
        const transcription = sttData.transcription.trim();
        console.log('Transcribed text:', transcription);
    
        // — Push user bubble —
        this.chatMessages.push({ sender: 'user', content: transcription });
        this.persistChatMessages();
        if (!this.currentWidgetId) {
          await this.createNewWidgetIfNeeded(transcription);
        }
        this.persistActiveWidgetToFirebase();
    
        // 3) Send to your agent
        this.isWaitingForAgent = true;
        const history = this.chatMessages.map(m => ({ sender: m.sender, content: m.content }));
        const agentResponse = await fetch('http://localhost:8000/run_task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
          body: JSON.stringify({ task: transcription, history })
        });
        if (!agentResponse.ok) {
          console.error('Agent request failed:', agentResponse.statusText);
          this.isWaitingForAgent = false;
          return;
        }
    
        // 4) Read the SSE stream and accumulate
        const reader = agentResponse.body!.getReader();
        const decoder = new TextDecoder();
        let aiReply = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          aiReply += decoder.decode(value, { stream: true });
        }
        this.isWaitingForAgent = false;
    
        // 5) Strip markdown fences & parse JSON if your AI wraps result in JSON
        try {
          aiReply = JSON.parse(aiReply);
        } catch {
          // not JSON, leave as-is
        }

        if (aiReply.startsWith('```')) {
          aiReply = aiReply.replace(/```[^\n]*\n?/, '').replace(/```$/, '');
        }
      
    
        // — Push AI bubble —
        this.chatMessages.push({ sender: 'ai', content: aiReply });
        this.persistChatMessages();
        this.persistActiveWidgetToFirebase();
    
        // 6) Finally, speak it
        const speechText = this.prepareSpeechText(aiReply);
        await this.playTts(speechText, 'af_bella');
    
      } catch (err) {
        console.error('Error in STT → AI → TTS flow:', err);
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
