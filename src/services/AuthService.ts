import { parseRecord } from '../util/record';

export class AuthService {
    constructor(private readonly storage: Storage) {}

    getToken(): string | null {
        // The deployed auth API stores { token, adminMode } in web-kit:session:v1.
        // Do not revive preserved legacy sessions after the user signs out.
        const auth = parseRecord(this.storage.getItem('web-kit:session:v1'));
        return typeof auth?.token === 'string' && auth.token.trim().length > 0
            ? auth.token
            : null;
    }
}
