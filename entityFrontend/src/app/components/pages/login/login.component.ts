import { HttpClient } from '@angular/common/http';
import { ResultModal } from './../../../models/result-modal/result-modal';
import { SocketService } from './../../../services/socket/socket.service';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { environment } from 'src/environments/environment';

// SERVICES
import { UserService } from 'src/app/services/user/user.service';
import { AlastriaLibService } from 'src/app/services/alastria-lib/alastria-lib.service';

// MODELS
import { User } from 'src/app/models/user/user.model';
import { Event } from 'src/app/models/enums/enums.model';

declare var $: any;
const alastriaLibJsonUrl = '../../../assets/alastria-lib.json';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
  export class LoginComponent implements OnInit {

  private subscription: Subscription = new Subscription();
  formLogin: FormGroup;
  errorLogin: string;
  qrData: string;
  resultModal: ResultModal = {
    type: 'error',
    title: '',
    description: ''
  };
  styleButtonFacebook = {
    color: '#5C7DC2',
    backgroundIcon: '#45619D',
    colorIcon: 'white'
  };
  styleButtonGoogle = {
    color: '#4081ED',
    backgroundIcon: 'white',
    colorIcon: 'black'
  };
  styleButtonAlastriaId = {
    color: '#00CAD6',
    backgroundIcon: 'white',
    colorIcon: 'black'
  };


  constructor(private router: Router,
              private fb: FormBuilder,
              private userService: UserService,
              private socketService: SocketService,
              private alastriaLibService: AlastriaLibService,
              private http: HttpClient) { }

  ngOnInit() {
    sessionStorage.clear();

    this.formLogin = this.fb.group({
      name: ['', Validators.required],
      password: ['', Validators.required],
    });
    this.createQrLogin();
  }

  /**
   * Function for submit login
   */
  async onSubmit(): Promise<any> {
    try {
      this.errorLogin = '';
      const user = {
        username: this.formLogin.get('name').value,
        password: this.formLogin.get('password').value
      };

      const userLogin = await this.userService.login(user);

      this.userService.setUserLoggedIn(userLogin);
      this.router.navigate(['/', 'home']);
    } catch (error) {
      if (error && error.status === 401) {
        this.errorLogin = 'User or password incorrect';
      } else {
        this.errorLogin = (error && error.message) ? error.message : 'Internal server error';
      }
    }

  }

  /**
   * Function that handle if click in any social button
   * @param socialName - type social (facebook, google or alastriaId)
   */
  handleLoginSocial(socialName: string): void {
    if (socialName === 'alastriaId') {
      this.initIoConnection();
      $('#simpleModal').modal('show');
    } else {
      console.log(socialName);
    }
  }

  handleOk() {
    this.socketService.sendLogin();
  }

  handleResultOK() {
    $('#modal-result').modal('hide');
  }

  /**
   * Function handle when click ok in modal simple
   * if user contain id then go to home page, but if user only contain authToken then go to vinculate
   */
  async onLogin(user: User): Promise<any> {
    try {
      this.userService.setUserLoggedIn(user);
      $('#simpleModal').modal('hide');
      this.router.navigate(['/', 'home']);
    } catch (error) {
      if (error && error.status === 401) {
        this.errorLogin = 'User or password incorrect';
      } else {
        this.errorLogin = (error && error.message) ? error.message : 'Internal server error';
      }
    }
  }

  private async createQrLogin() {
    this.qrData = await this.createAlastriaToken();
  }

  private async createAlastriaToken(): Promise<string> {
    const currentDate = Math.floor(Date.now() / 1000);
    const expDate = currentDate + 600;
    const alastriaLibJson: any = await this.http.get(alastriaLibJsonUrl).toPromise();
    const config = {
      did: alastriaLibJson.header.kid,
      providerUrl: alastriaLibJson.openAccess,
      callbackUrl: `${environment.apiUrl}/entity/alastriaToken`,
      alastriaNetId: 'redT',
      tokenExpTime: expDate,
      tokenActivationDate: currentDate,
      jsonTokenId: Math.random().toString(36).substring(2)
    };
    const alastriaToken = this.alastriaLibService.createAlastriaToken(config);

    return this.alastriaLibService.signJWT(alastriaToken, alastriaLibJson.privateKey);
  }

  /**
   * Function for init connection with websocket and subscribe in differents events
   */
  private initIoConnection(): void {
    this.socketService.initSocket();

    this.subscription.add(this.socketService.onLogin()
      .subscribe((result) => {
        let userStorage: User;
        if (result.userData && result.authToken) {
          userStorage = result.userData;
          userStorage.authToken = result.authToken;
          this.onLogin(userStorage);
        } else {
          this.router.navigate(['/', 'vinculate']);
        }

        this.socketService.sendDisconnect();
      })
    );

    this.subscription.add(this.socketService.onError()
      .subscribe((error: any) => {
        $('#simpleModal').modal('hide');
        this.socketService.sendDisconnect();
        this.resultModal = {
          type: 'error',
          title: `Error! - error.status`,
          description: error.message
        };
        $('#modal-result').modal('show');
      })
    );

    this.subscription.add(this.socketService.onEvent(Event.CONNECT)
      .subscribe(() => {
        console.log('connected - websocket');
      })
    );

    this.subscription.add(this.socketService.onEvent(Event.DISCONNECT)
      .subscribe(() => {
        console.log('disconnected - websocket');
      })
    );
  }

  // tslint:disable-next-line: use-life-cycle-interface
  ngOnDestroy() {
    this.subscription.unsubscribe();
    this.socketService.sendDisconnect();
  }
}
