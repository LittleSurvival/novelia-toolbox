import { parseRecord } from '../util/record';

export class AuthService {
    constructor(private readonly storage: Storage) {}

    getToken(): string | null {
        // The deployed auth API stores { token, adminMode } in auth-v2.
        // Do not revive preserved legacy sessions after the user signs out.
        const auth = parseRecord(this.storage.getItem('auth-v2'));
        return typeof auth?.token === 'string' && auth.token.trim().length > 0
            ? auth.token
            : null;
    }
}
