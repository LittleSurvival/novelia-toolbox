import type { StoredModule } from './StoredModule';

export interface StoredConfiguration {
    version: number;
    modules: StoredModule[];
}
