import { ChangeDetectorRef, Component } from '@angular/core';
import { Router } from '@angular/router';
import { 
  browserLocalPersistence,
  createUserWithEmailAndPassword, 
  getAuth, 
  setPersistence, 
  signInWithEmailAndPassword, 
  updateProfile 
} from 'firebase/auth';
import { AuthService } from '../auth.service';

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
      // Set persistence to local so that the session is retained after reload
      await setPersistence(auth, browserLocalPersistence);
  
      const userCredential = await signInWithEmailAndPassword(auth, this.loginObj.userName, this.loginObj.password);
      const user = userCredential.user;
      console.log('User logged in:', user);
      localStorage.setItem('isLoggedIn', 'true');
  
      // Set role based on email and navigate
      if (this.loginObj.userName === 'admin@domain.com') {
        localStorage.setItem('role', 'admin');
        console.log('Role set to:', localStorage.getItem('role'));
        this.router.navigate(['/home']).then(() => {
          location.reload();
        });
      } else {
        localStorage.setItem('role', 'operator');
        console.log('Role set to:', localStorage.getItem('role'));
        this.router.navigate(['/home']);
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed. Please check your credentials.');
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

      localStorage.setItem('isLoggedIn', 'true');
      
      // Optionally update the user's displayName with the provided username
      await updateProfile(user, { displayName: registerUsername.value });
      await user.reload();
      localStorage.setItem('displayName', registerUsername.value);
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
