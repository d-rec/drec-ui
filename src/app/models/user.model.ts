 
import {IFullOrganization} from './organization.model';
import {UserEnumStatus,Role} from '../utils/drec.enum'
 export interface IUserProperties {
    id: number;
    title?: string;
    firstName: string;
    lastName: string;
    telephone?: string;
    email: string;
    notifications: boolean;
    status: UserEnumStatus;
    role: Role;
    roleId?:number;
    //permissions?:PermissionString;
    organization: IFullOrganization;
  }