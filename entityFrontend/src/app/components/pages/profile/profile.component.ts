import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from './../../../../environments/environment';
import { DeviceDetectorService } from 'ngx-device-detector';
import { Component, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';

// COMPONENTS
import { CreateAlastriaIdComponent } from '../../common/create-alastria-id/create-alastria-id.component';
import { UserFormComponent } from 'src/app/components/common/user-form/user-form.component';

// SERVICES
import { UserService } from 'src/app/services/user/user.service';
import { SocketService } from 'src/app/services/socket/socket.service';
import { AlastriaLibService } from 'src/app/services/alastria-lib/alastria-lib.service';

// MODELS
import { User } from 'src/app/models/user/user.model';
import { ResultModal } from './../../../models/result-modal/result-modal';
import { Event } from 'src/app/models/enums/enums.model';

declare var $: any;
const alastriaLibJsonUrl = '../../../assets/alastria-lib.json';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styles: [
    `
    :host ::ng-deep app-user-form > form,  #create-alastria-id{
      padding-left: 40px;
    }
    :host ::ng-deep app-generate-qr qrcode > img{
      margin: auto;
    }
    `
  ],
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  private subscription: Subscription = new Subscription();
  @ViewChild(CreateAlastriaIdComponent) createAlastriaIdComponent: CreateAlastriaIdComponent;
  @ViewChild(UserFormComponent) userFormComponent: UserFormComponent;
  user: User;
  isDesktop: boolean;
  qrAlastriaId: string;
  qrCredentials: any;
  optionsMenu = ['Edit profile', 'Reset password', 'Alastria ID'];
  optionSelected = '';
  resultModal: ResultModal = {
    type: 'success',
    title: '',
    description: ''
  };
  styleButtonAlastriaId = {
    color: '#00CAD6',
    backgroundIcon: 'white',
    colorIcon: 'black'
  };
  parametersForCreateAlastriaId: any;
  isCreateAlastriaId: boolean;
  qrDataFillProfile: any = '[]';
  inputsUserForm: Array<any> = [
    {
      label: 'Name',
      type: 'text',
      name: 'name',
      value: 'name',
      icon: 'user'
    },
    {
      label: 'Surname',
      type: 'text',
      name: 'surname',
      value: 'surname',
      icon: 'user'
    },
    {
      label: 'Username',
      type: 'text',
      name: 'username',
      value: 'username',
      icon: 'user'
    },
    {
      label: 'Email',
      type: 'email',
      name: 'email',
      value: 'email',
      icon: 'envelope'
    },
    {
      label: 'Address',
      type: 'text',
      name: 'address',
      value: 'address',
      icon: 'map-marker'
    },
    {
      label: 'Title',
      type: 'text',
      name: 'titleLegalBlockchain',
      value: 'titleLegalBlockchain',
      icon: 'envelope'
    }
  ];
  inputsResetPassword: Array<any> = [
    {
      label: 'Password',
      type: 'password',
      name: 'password',
      value: 'password',
      icon: 'key',
      required: true
    },
    {
      label: 'Repeat password',
      type: 'password',
      name: 'repeatPassword',
      value: 'repeatPassword',
      icon: 'key',
      required: true
    }
  ];

  constructor(private userService: UserService,
              private socketService: SocketService,
              private alastriaLibService: AlastriaLibService,
              private http: HttpClient,
              private changeDetector: ChangeDetectorRef,
              private deviceDetectorService: DeviceDetectorService) {
    this.isDesktop = this.deviceDetectorService.isDesktop();
  }

  ngOnInit() {
    this.user = this.userService.getUserLoggedIn();
    this.initIoConnection();
    this.addOptionInMenu();
  }

  /**
   * Handle when a otion of menu is selected
   * @param option - option selected
   */
  handleSelectOption(option: string): void {
    switch (option) {
      case this.optionsMenu[0]:
        this.userFormComponent.toggleFormState();
        this.optionSelected = (this.optionSelected === option) ? '' : option;
        break;
      case 'Fill your AlastriaID profile':
        this.fillYourProfile();
        break;
      case 'Alastria ID':
        $('#modalCreateAlastriaId').modal('show');
        break;
      case 'Create Alastria ID':
        this.sendAlastriaTokenToApp();
        break;
      default:
        this.optionSelected = (this.optionSelected === option) ? '' : option;
        break;
    }
  }

  async handleCreateAlastriaId() {
    this.isCreateAlastriaId = true;
    this.parametersForCreateAlastriaId = {
      title: 'Create your AlastriaID',
      subtitle: 'Scan this QR with your AlastriaID app to create your AlastriaID',
      type: 'C'
    };
    this.changeDetector.detectChanges();
    await this.createAlastriaIdComponent.createOrSetUpAlastriaId();
    $('#modalCreateAlastriaId').modal('hide');
    this.initIoConnection();
  }

  async handleSetUpAlastriaId() {
    this.isCreateAlastriaId = true;
    this.parametersForCreateAlastriaId = {
      title: `Set up your Alastria ID for ${environment.entityName}`,
      subtitle: 'Scan this QR with your AlastriaID',
      type: 'S'
    };
    this.changeDetector.detectChanges();
    await this.createAlastriaIdComponent.createOrSetUpAlastriaId();
    $('#modalCreateAlastriaId').modal('hide');
    this.initIoConnection();
  }

  /**
   * Handle when generate qr for create alastria id
   * @param  event - config of create alastria id
   */
  handleGenerateQr(event: string): void {
    this.qrAlastriaId = event;

    // MOCK - WEBSOCKET
    if (this.qrAlastriaId) {
      setTimeout(() => {
        if (this.parametersForCreateAlastriaId.type === 'C') {
          this.socketService.sendCreate('0xf9016781a980830927c094812c27bb1f50bcb4a2fea015bd89c3691cd759a580b901046d69d99a000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000a450382c1a00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000042303366646435376164656333643433386561323337666534366233336565316530313665646136623538356333653237656136363638366332656135333538343739000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001ca0cdf15464981e07eea36867ee40d24091a20a1c0750dc2db5b4a4136d1e4e4d80a03679a4efecffd8122ddba7391feaefb1a0a4623a224701bb8f97c6763e915f55');
        } else {
          this.socketService.sendSetUp();
        }
      }, 5000);
    }
  }

  /**
   * When click in 'ok' in simple modal then active this function that hide
   * the modal and check alastria id is verified
   */
  handleOk(): void {
    $('#simpleModal').modal('hide');
  }

  /**
   * When click in 'ok' in simple modal then active this function that hide
   * the modal and check alastria id is verified
   */
  handleResultModalOk(): void {
    $('#modal-result').modal('hide');
    this.qrAlastriaId = null;
    this.addOptionInMenu();
  }

  /**
   * handle when click in 'save' of edit profile then set user from
   * userService
   * @param user - new data of user for change or resetPassword
   */
  async handleEditProfile(user: User): Promise<any> {
    const userResult = await this.userService.updateUser(user);
    userResult.user.userData.authToken = this.user.authToken;
    this.userService.setUserLoggedIn(userResult.user.userData);
    this.user = this.userService.getUserLoggedIn();
    this.userFormComponent.toggleFormState();
    this.optionSelected = '';
  }

  /**
   * handle when click in 'save' of edit profile then set user from
   * userService
   * @param user - new data of user for change or resetPassword
   */
  async handleResetPassword(user: any): Promise<any> {
    const userNewPassword = {
      id: user.id,
      password: user.password
    };
    userNewPassword.id = this.user.id;
    const userResult = await this.userService.updatePassword(userNewPassword);
    userResult.authToken = this.user.authToken;
    this.optionSelected = '';
  }

  handleOkFillYourProfile() {
    this.socketService.sendFillYourProfile();
  }

  /**
   * Handle when click in fill your profile button of modal form then
   * hide modalFillProfile and show simple modal with qr
   * @param profileFields - fields of profile for show in qr modal
   */
  async handleFillYourProfile(profileFields: Array<string>) {
    await $('#modalFillProfile').modal('hide');
    this.qrDataFillProfile = JSON.stringify(profileFields);
    this.initIoConnection();
    const credentials = await this.createCredentials(profileFields);
    this.qrDataFillProfile = JSON.stringify({
      verifiableCredential: credentials
    });
    $('#simpleModal').modal('show');
  }

  private async sendAlastriaTokenToApp() {
    const alastriaToken = await this.createAlastriaToken();
    const message = {
      alastriaToken,
      callbackUrl: `${environment.callbackUrl}/entity/user?id=${this.user.id}`
    };

    this.socketService.sendCreateIdentityWs(message);
  }

  private async createAlastriaToken(): Promise<string> {
    const currentDate = Math.floor(Date.now() / 1000);
    const expDate = currentDate + 600;
    const alastriaLibJson: any = await this.http.get(alastriaLibJsonUrl).toPromise();
    const config = {
      did: alastriaLibJson.header.kid,
      providerUrl: alastriaLibJson.openAccess,
      callbackUrl: `${environment.callbackUrl}/entity/alastria/identity`,
      alastriaNetId: 'redT',
      tokenExpTime: expDate,
      tokenActivationDate: currentDate,
      jsonTokenId: Math.random().toString(36).substring(2)
    };
    const alastriaToken = this.alastriaLibService.createAlastriaToken(config);

    return this.alastriaLibService.signJWT(alastriaToken, alastriaLibJson.privateKey);
  }

  private async createCredentials(fields: Array<string>) {
    const url = '../../../assets/alastria-lib.json';
    const alastriaLibJson: any = await this.http.get(url).toPromise();
    try {
      const credentials = [];
      fields.map((field: string)  => {
        alastriaLibJson.payload.credentialSubject = {
          levelOfAssurance : 'High'
        };
        alastriaLibJson.payload.credentialSubject[field] = (field === 'fullname') ? `${this.user.name} ${this.user.surname}`
          : this.user[field];
        alastriaLibJson.payload.sub = this.user.did;
        const credential =  this.alastriaLibService.createCredential(alastriaLibJson.header, alastriaLibJson.payload);
        credentials.push(this.alastriaLibService.signJWT(credential.payload, alastriaLibJson.privateKey));
      });

      return credentials;
    } catch(error) {
      console.error(error);
    }
  }

  private addOptionInMenu() {
    const titleOptionFill = 'Fill your AlastriaID profile';

    if (this.user.vinculated && !this.optionsMenu.includes(titleOptionFill)) {
      this.optionsMenu.splice(this.optionsMenu.length - 1, 1);
      this.optionsMenu.push(titleOptionFill);
    }

    const titleOptionCreate = 'Create Alastria ID';
    if (!this.isDesktop && this.optionsMenu.includes('Alastria ID')) {
      this.optionsMenu.splice(this.optionsMenu.length - 1, 1);
      this.optionsMenu.push(titleOptionCreate);
    }
  }

  private fillYourProfile(): void {
    $('#modalFillProfile').modal('show');
  }

  /**
   * Function for init connection with websocket and subscribe in differents events
   */
  private initIoConnection(): void {
    this.socketService.initSocket();

    this.subscription.add(this.socketService.onCreateIdentity()
      .subscribe((response: any) => {
        this.socketService.sendDisconnect();
        let user = this.userService.getUserLoggedIn();
        if (response.userData) {
          user = response.userData;
          user.authToken = response.authToken;
        } else if (response.did) {
          user.did = response.did;
          user.vinculated = true;
        }
        this.userService.updateUser(user)
          .then((result: any) => {
            const userUpdated = result.user.userData;
            userUpdated.authToken = result.user.authToken;
            this.userService.setUserLoggedIn(userUpdated);
            this.resultModal = {
              type: 'success',
              title: 'Congratulations!',
              description: 'Your Alastria ID has been created. Start to fill you new AlastriaID'
            };
            this.user = this.userService.getUserLoggedIn();
            this.isCreateAlastriaId = false;
            $('#modal-result').modal('show');
          })
        .catch((error: any) => {
          console.error(error);
        });
      })
    );

    this.subscription.add(this.socketService.onSession()
      .subscribe((response) => {
        this.socketService.sendDisconnect();
        let user = this.userService.getUserLoggedIn();
        if (response.userData) {
          user = response.userData;
          user.authToken = response.authToken;
        } else if (response.did) {
          user.did = response.did;
          user.vinculated = true;
        }
        this.userService.updateUser(user)
          .then((result: any) => {
            const userUpdated = result.user.userData;
            userUpdated.authToken = result.user.authToken;
            this.userService.setUserLoggedIn(userUpdated);
            this.resultModal = {
              type: 'success',
              title: 'Congratulations!',
              description: `Your AlastriaID has been linked to your ${environment.entityName} profile. Now you can login next times with your AlastriaID`
            };
            this.user = this.userService.getUserLoggedIn();
            this.isCreateAlastriaId = false;
            $('#modal-result').modal('show');
          });
      })
    );

    this.subscription.add(this.socketService.onFillYourProfile()
      .subscribe(() => {
        this.socketService.sendDisconnect();
        $('#simpleModal').modal('hide');
        this.resultModal = {
          type: 'success',
          title: 'Success!',
          description: 'Now use your Alastria ID wherever you want and keep the control of your information'
        };
        $('#modal-result').modal('show');
      })
    );

    this.subscription.add(this.socketService.onError()
      .subscribe((error: any) => {
        this.socketService.sendDisconnect();
        $('#simpleModal').modal('hide');
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
    this.socketService.sendDisconnect();
    this.subscription.unsubscribe();
  }
}
