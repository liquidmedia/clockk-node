var request = require('request');
import { Serializer, Deserializer } from 'ts-jsonapi';

export interface ClockkToken {
  access_token: String,
  refresh_token: String,
  token_type: String,
  expires_in: Number
  created_at: Date,
  scope: String
}

export interface ClockkOptions {
  token?: ClockkToken,
  api_url?: String,
  customer_id?: String
}

export class Clockk {
  constructor(public options: ClockkOptions) { }

  async exchangeCodeForToken(claims: { code: String, client_id: String, client_secret: String, redirect_uri: String }) {
    return new Promise<ClockkToken>((resolve, reject) => {
      request
        .post(
          { url: `${this.options.api_url}/oauth/token?client_id=${claims.client_id}&client_secret=${claims.client_secret}&grant_type=authorization_code&code=${claims.code}&redirect_uri=${claims.redirect_uri}` },
          (error: any, response: any, body: any) => {
            if (error) {
              reject(error);
            } else {
              if (response.statusCode && response.statusCode >= 200 && response.statusCode <= 299) {
                let token = JSON.parse(body);
                this.options.token = token;
                resolve(token);
              } else {
                reject(JSON.parse(body));
              }
            }
          }
        )
    });
  }

  private async clockkGetRequest(appendUrl: String): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.options.token) {
        reject("token option must be set in constructor")
      }
      request
        .get({
          url: `${this.options.api_url}${appendUrl}`,
          headers: {
            'Authorization': this.options.token?.access_token
          }
        }, (error: any, response: any, body: any) => {
          if (error) {
            reject(error);
          } else {
            if (response.statusCode && response.statusCode >= 200 && response.statusCode <= 299) {
              resolve(new Deserializer().deserialize(JSON.parse(body)))
            } else {
              reject(JSON.parse(body));
            }
          }
        })
    })
  }

  async getCustomer() {
    return await this.clockkGetRequest("/oauth/me")
  }

  async getProjects() {
    return new Promise(async (resolve, reject) => {
      if (!this.options.customer_id) {
        reject("customer_id option must be set")
      }
      let projects = await this.clockkGetRequest("/api/v1/" + this.options.customer_id + "/projects")
      resolve(projects)
    })
  }

  /*
  Create an Clockk integration performed action. This will close any open modals in the Clockk user interface
  and the data enclosed here will be included the next time this resource is sent to your integration.

  actionCode: The action code identifier defined in the integration management page https://app.clockk.com/integration-listings
  resourceType: The name of the resource type, dasherized
  actionData: The payload of JSON formatted data you would like stored with this integration performed action. Max size 2KB

  example:
  Clockk.createIntegrationPerformedAction(
    'LINK_TASK_TYPE_TO_INTEGRATION',
    {
      id: '96a770cd-b677-49dc-b733-f4b53197f81c',
      name: 'Programming',
      description: 'Elixir rocks'
    }
    'task-type',
    {
      additionalInfo: 'arbitrary information about this task type'
    }
  )
  */
  async createIntegrationPerformedAction(actionCode: String, resource: any, actionData: any) {
    return new Promise(async (resolve, reject) => {
      let resourceType = await this.getResourceTypeFromResource(resource)
      let attrs: any = {
        'metadata': actionData,
        'action-code': actionCode,
      }
      attrs[resourceType + '-id'] = resource.id
      let data =
        new Serializer(
          'integration-performed-actions',
          { id: 'id', attributes: ['metadata', 'action-code', `${resourceType}-id`] }
        )
          .serialize(attrs)

      let ipa = await this.clockkCreateRequest('integration-performed-actions', data)
      resolve(ipa)
    })
  }

  private getResourceTypeFromResource(resource: any) {
    return new Promise<String>((resolve, reject) => {
      let resourceType: String = ''
      switch (true) {
        case typeof resource.color !== undefined:
          resourceType = 'project'
          break;

        case typeof resource.time_sheet_date !== undefined:
          resourceType = 'time-sheet'
          break;

        case typeof resource.duration !== undefined:
          resourceType = 'time-sheet-entry'
          break;

        case typeof resource.notes !== undefined:
          resourceType = 'client'
          break;

        case typeof resource.description !== undefined:
          resourceType = 'task-type'
          break;

        default:
          reject('invalid resource. This property should not be modified from the version supplied in the inital Clockk action request')
      }
      resolve(resourceType)
    })
  }

  private async clockkCreateRequest(appendUrl: String, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.options.customer_id) {
        reject("customer_id option must be set")
      }
      if (!this.options.token) {
        reject("token option must be set in constructor")
      }

      request
        .post({
          url: `${this.options.api_url}/api/v1/${this.options.customer_id}/${appendUrl}`,
          headers: {
            'Authorization': this.options.token?.access_token,
            'Content-Type': 'application/vnd.api+json'
          },
          body: JSON.stringify(payload)
        }, (error: any, response: any, body: any) => {
          if (error) {
            reject(error);
          } else {
            if (response.statusCode && response.statusCode >= 200 && response.statusCode <= 299) {
              resolve(new Deserializer().deserialize(JSON.parse(body)))
            } else {
              reject(JSON.parse(body));
            }
          }
        })
    })
  }
}