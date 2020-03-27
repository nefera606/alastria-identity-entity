import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

// Models
import { Identity } from 'src/app/models/identity/identity.model';

import { environment } from '../../../environments/environment';


@Injectable({
  providedIn: 'root'
})
export class EntityService {

  apiUrl = environment.apiUrl;
  path = 'entity/alastria';

  constructor(private http: HttpClient) { }

  /**
   * Function for create identity calling at the server
   * @param identity - data of identity for create a new identity
   * @returns {*}
   */
  createIdentity(identity: Identity): any {
    return this.http.post(`${this.apiUrl}/${this.path}/identity`, identity).toPromise()
      .then((res) => res)
      .catch((error: any) => {
        // throw error;
        // MOCK
        return {
          proxyAddress: '0x374bfe163e60d348ddcdfe90e80c81393bc84df1',
          did: 'did:ala:quor:redT:374bfe163e60d348ddcdfe90e80c81393bc84df1'
        };
      });
  }

  /**
   * @param alastriaId - identifier of alastria for get public key
   * @returns {*}
   */
  getPublicKey(alastriaId: string): any {
    return this.http.get(`${this.apiUrl}/${this.path}/identity/${alastriaId}`).toPromise()
      .then((res) => {
        console.log('res --> ', res);
        return res;
      })
      .catch((error: any) => {
        throw error;
      });
  }

  /**
   * Function for add subject credential by the isssuer calling at the server
   * @param signedTX - hash of the signed transaction
   * @returns {*}
   */
  addIssuerCredentials(issuerCredential: any): any {
    console.log(issuerCredential)
    let credentialData = {
      issuerCredential
    }
    console.log(credentialData)
    return this.http.post(`${this.apiUrl}/${this.path}/credential`, credentialData).toPromise()
      .then((res) => {
        return res
      })
      .catch((error: any) => {
      })

  }
}
