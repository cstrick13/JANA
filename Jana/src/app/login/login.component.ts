import { ChangeDetectorRef, Component, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { 
  browserLocalPersistence,
  createUserWithEmailAndPassword, 
  getAuth, 
  setPersistence, 
  signInWithEmailAndPassword, 
  updateProfile 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

import { AuthService } from '../auth.service';
import { invoke } from '@tauri-apps/api/core';
import { AppModule } from '../app.module';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'], // Corrected property name
  standalone: false
})
export class LoginComponent {
  state = AuthenticatorCompState.LOGIN;
  loginObj: any = {
    userName: '',
    password: '',
  };

  constructor(private router: Router, private cdr:ChangeDetectorRef,private authService: AuthService) {}

  onChangeLogin() {
    this.state = AuthenticatorCompState.LOGIN;
  }

  async onLogin() {
    console.log('Login button clicked', this.loginObj);
    const auth = getAuth();
  
    try {
      // Set persistence so that the session is retained after reload
      await setPersistence(auth, browserLocalPersistence);
  
      // Sign in with email and password
      const userCredential = await signInWithEmailAndPassword(
        auth, 
        this.loginObj.userName, 
        this.loginObj.password
      );
      const user = userCredential.user;
      console.log('User logged in:', user);

      await invoke('set_local_storage', { key: 'displayName', value: user.displayName });
  
      // Generate a custom token using the user's UID from your Tauri backend
      const customToken = await invoke<string>('generate_custom_token', { uid: user.uid });
      if (customToken) {
        console.log('Custom token generated:', customToken);
        // Save the custom token in Tauri storage for later reauthentication
        const tokenResult = await invoke('set_local_storage', { key: 'customToken', value: customToken });
        console.log('Custom token stored in Tauri storage:', tokenResult);
      } else {
        console.error('Custom token generation returned no token.');
      }
  
      // Mark login status in Tauri storage
      await invoke('set_local_storage', { key: 'isLoggedIn', value: 'true' });
      const docRef = doc(AppModule.db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      let role = 'worker'; // default role
      if (docSnap.exists()) {
        role = docSnap.data()['role'] || 'worker';
      }
      console.log('Retrieved role from Firestore:', role);
      await invoke('set_local_storage', { key: 'role', value: role });
  
      // Navigate to the home page once all work is done
      await this.router.navigate(['/home']);
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed. Please check your credentials.');
      return; // Ensure we don't navigate to home on error.
    }
  }
  
  

  // New registration method using template reference variables
  async registerUser(
    registerUsername: HTMLInputElement,
    registerEmail: HTMLInputElement,
    registerPassword: HTMLInputElement,
    registerConfirmPassword: HTMLInputElement
  ): Promise<void> {
    // Validate that the password fields match
    if (registerPassword.value !== registerConfirmPassword.value) {
      alert('Passwords do not match.');
      return;
    }
    
    const auth = getAuth();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, registerEmail.value, registerPassword.value);
      const user = userCredential.user;
      console.log('User registered:', user);
      let role = 'worker'; 
      await setDoc(doc(AppModule.db, 'users', user.uid), {
        role: 'worker', 
        displayName: registerUsername.value,
        email: registerEmail.value,
      });


      try {
        console.log('➡️ Invoking set_local_storage with:', { key: 'isLoggedIn', value: 'true' });
        const result = await invoke('set_local_storage', { key: 'isLoggedIn', value: 'true' });
        console.log('✅ invoke(set_local_storage) succeeded:', result);
      } catch (err) {
        console.error('❌ invoke(set_local_storage) failed:', err);
      }
      const customToken = await invoke<string>('generate_custom_token', { uid: user.uid });
      if (customToken) {
        console.log('Custom token generated:', customToken);
        // Save the custom token in Tauri storage for later reauthentication
        const tokenResult = await invoke('set_local_storage', { key: 'customToken', value: customToken });
        console.log('Custom token stored in Tauri storage:', tokenResult);
      } else {
        console.error('Custom token generation returned no token.');
      }
      
      // Optionally update the user's displayName with the provided username
      await updateProfile(user, { displayName: registerUsername.value });
      await user.reload();
      await invoke('set_local_storage', { key: 'displayName', value: user.displayName });
      await invoke('set_local_storage', { key: 'role', value: role });
      this.authService.updateCurrentUser(user);
      this.router.navigate(['/home'])
    } catch (error) {
      console.error('Registration error:', error);
      alert('Registration failed. Please check your credentials and try again.');
    }
  }

  isLoginState() {
    return this.state === AuthenticatorCompState.LOGIN;
  }
  isRegisterState() {
    return this.state === AuthenticatorCompState.REGISTER;
  }
  isForgotPasword() {
    return this.state === AuthenticatorCompState.FORGOT_PASSWORD;
  }

  isNotEmpty(text: string) {
    return text != null && text.length > 0;
  }
  isAMatch(text: string, comparedWith: string) {
    return text === comparedWith;
  }

  getStateText() {
    switch (this.state) {
      case AuthenticatorCompState.LOGIN:
        return "Login";
      case AuthenticatorCompState.REGISTER:
        return "Register";
      case AuthenticatorCompState.FORGOT_PASSWORD:
        return "Forgot Password";
    }
  }
  onRegister(){
    this.state = AuthenticatorCompState.REGISTER;
  }
}

export enum AuthenticatorCompState {
  LOGIN,
  REGISTER,
  FORGOT_PASSWORD
}
