const opendsu = require("opendsu");
const storage = opendsu.loadApi('storage')

class DSUService {

    PATH = "/";

    constructor(path = this.PATH) {
        this.DSUStorage = storage.getDSUStorage();
        this.PATH = path;
    }

    letDSUStorageInit = () => {
        if (typeof this.initializationPromise === 'undefined') {
            this.initializationPromise = new Promise((resolve) => {
                if (this.DSUStorage === undefined || this.DSUStorage.directAccessEnabled === true) {
                    return resolve();
                }
                this.DSUStorage.enableDirectAccess(() => {
                    resolve();
                })
            });
        }
        return this.initializationPromise;
    }

    getEntities(path, callback) {
        [path, callback] = this.swapParamsIfPathIsMissing(path, callback);
        const resolver = opendsu.loadAPI('resolver');
        this.letDSUStorageInit().then(() => {
            this.DSUStorage.listMountedDSUs(path, (err, dsuList) => {
                if (err) {
                    return callback(err, undefined);
                }
                let entities = [];
                let getServiceDsu = (dsuItem) => {
                    let objectName = this.PATH.substring(1);
                    let itemPathSplit = dsuItem.path.split('/')
                    if (itemPathSplit.length > 1) {
                        objectName = itemPathSplit[0];
                    }
                    resolver.loadDSU(dsuItem.identifier, (err, dsu) => {
                        if (err) {
                            return callback(err);
                        }
                        dsu.readFile('/data.json', (err, content) => {
                            if (err) {
                                entities.slice(0);
                                return callback(err, undefined);
                            }
                            let entity = JSON.parse(content.toString());
                            entity.objectName = objectName;
                            entities.push(entity);

                            if (dsuList.length === 0) {
                                return callback(undefined, entities);
                            }
                            getServiceDsu(dsuList.shift());
                        });
                    });
                };
                if (dsuList.length === 0) {
                    return callback(undefined, []);
                }
                getServiceDsu(dsuList.shift());
            })
        });
    }

    async getEntitiesAsync(path) {
        return this.asyncMyFunction(this.getEntities, [...arguments])
    }

    getEntity(uid, path, callback) {
        [path, callback] = this.swapParamsIfPathIsMissing(path, callback);
        const resolver = opendsu.loadAPI('resolver');
        resolver.loadDSU(uid, (err, dsu) => {
            if (err) {
                return callback(err);
            }
            dsu.readFile('/data.json', (err, data) => {
                if (err) {
                    return callback(err, undefined);
                }
                callback(undefined, JSON.parse(data.toString()));
            });
        });
    }

    async getEntityAsync(uid, path) {
        return this.asyncMyFunction(this.getEntity, [...arguments])
    }

    saveEntity(entity, path, callback) {
        [path, callback] = this.swapParamsIfPathIsMissing(path, callback);
        const resolver = opendsu.loadAPI('resolver');
        const keySSISpace = opendsu.loadAPI('keyssi');
        const securityContext = opendsu.loadAPI('sc');
        const templateSSI = keySSISpace.createTemplateSeedSSI('default');
        // TODO: Change to createDSUx
        entity.volatile = undefined;
        resolver.createDSU(templateSSI, (err, dsuInstance) => {
            if (err) {
                return callback(err);
            }
            dsuInstance.getKeySSIAsString((err, keySSI) => {
                if (err) {
                    return callback(err);
                }
                this.letDSUStorageInit().then(() => {
                    this.DSUStorage.mount(path + '/' + keySSI, keySSI, (err) => {
                        this.updateEntity(this._getEntityWithIdentifiers(entity, keySSI), path, callback);
                    });
                });
            });
        });
    }

    async saveEntityAsync(entity, path) {
        return this.asyncMyFunction(this.saveEntity, [...arguments])
    }

    updateEntity(entity, path, callback) {
        [path, callback] = this.swapParamsIfPathIsMissing(path, callback);
        const resolver = opendsu.loadAPI('resolver');
        entity.volatile = undefined;
        resolver.loadDSU(entity.uid,
            //{skipCache: true},
            (err, dsu) => {
                if (err) {
                    return callback(err);
                }
                dsu.writeFile('/data.json', JSON.stringify(entity), (err) => {
                    if (err) {
                        return callback(err, undefined);
                    }
                    callback(undefined, entity);
                });
            });
    }

    async updateEntityAsync(entity, path) {
        return this.asyncMyFunction(this.updateEntity, [...arguments])
    }

    mountEntity(keySSI, path, callback) {
        [path, callback] = this.swapParamsIfPathIsMissing(path, callback);
        this.letDSUStorageInit().then(() => {
            this.DSUStorage.mount(path + '/' + keySSI, keySSI, (err) => {
                this.getEntity(keySSI, (err, entity) => {
                    if (err) {
                        return callback(err, undefined);
                    }
                    this.updateEntity(this._getEntityWithIdentifiers(entity, keySSI), path, callback);
                })
            });
        });
    }

    async mountEntityAsync(keySSI, path) {
        return this.asyncMyFunction(this.mountEntity, [...arguments])
    }

    unmountEntity(uid, path, callback) {
        [path, callback] = this.swapParamsIfPathIsMissing(path, callback);
        let unmountPath = path + '/' + uid;
        this.DSUStorage.unmount(unmountPath, (err, result) => {
            if (err) {
                return callback(err, undefined);
            }
            callback(undefined, result);
        });
    }

    async unmountEntityAsync(uid, path) {
        return this.asyncMyFunction(this.unmountEntity, [...arguments])
    }

    makeSSIReadOnly(seedSSI, callback) {
        const keySSISpace = opendsu.loadAPI('keyssi');
        let parsedSeedSSI = keySSISpace.parse(seedSSI);
        callback(undefined, parsedSeedSSI.derive().getIdentifier());
    }

    _getEntityWithIdentifiers(entity, keySSI) {
        // TODO: Decide the name of the identifier and remove the others.
        entity.KeySSI = keySSI;
        entity.keySSI = keySSI;
        entity.uid = keySSI;
        return entity;
    }

    _getDsuStoragePath(keySSI, path = this.PATH) {
        return path + '/' + keySSI + '/data.json';
    }

    swapParamsIfPathIsMissing(path, callback) {
        return typeof path === 'function' ? [this.PATH, path] : [path, callback];
    }

    asyncMyFunction = (func, params) => {
        func = func.bind(this)
        return new Promise((resolve, reject) => {
            func(...params, (err, data) => {
                if (err) {
                    return reject(err);
                }
                resolve(data);
            })
        })
    }
}

module.exports = DSUService;