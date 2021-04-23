const opendsu = require("opendsu");
const w3cDID = opendsu.loadAPI('w3cdid');

const SPONSOR_IDENTITY = "sponsorIdentity";
const HCO_IDENTITY = "hcoIdentity";
const PATIENT_IDENTITY = "patientIdentity";

class CommunicationService {

    DEFAULT_FORMAT_IDENTIFIER = "did";
    DEMO_METHOD_NAME = "demo";

    listenerIsActive = false;

    constructor(identity) {
        w3cDID.createIdentity(this.DEMO_METHOD_NAME, identity, (err, didDocument) => {
            if (err) {
                throw err;
            }
            this.didDocument = didDocument;
            console.log(`Identity ${didDocument.getIdentifier()} created successfully.`)
        });
    }

    sendMessage(destinationIdentity, message) {
        let senderIdentifier = this.didDocument.getIdentifier();
        let toSentObject = {
            sender: senderIdentifier.split(':')[2],
            message: message
        }
        const recipientIdentity = this.DEFAULT_FORMAT_IDENTIFIER + ':' + this.DEMO_METHOD_NAME + ':' + destinationIdentity;
        debugger;
        this.didDocument.sendMessage(JSON.stringify(toSentObject), recipientIdentity, (err) => {
            if (err) {
                throw err;
            }

            console.log(`${senderIdentifier} sent a message to ${recipientIdentity}.`);
        });
    }

    readMessage(callback) {
        this.listenerIsActive = true;
        this.didDocument.readMessage((err, msg) => {
            this.listenerIsActive = false;
            if (err) {
                return callback(err);
            }
            console.log(`${this.didDocument.getIdentifier()} received message: ${msg}`);
            callback(err, msg);
        });
    }

    listenForMessages(callback) {
        setInterval(() => {
            if (!this.listenerIsActive) {
                this.readMessage(callback)
            }
        }, 100);
    }
}

let instance = null;

const getInstance = (identity) => {
    if (instance === null) {
        instance = new CommunicationService(identity);
    }
    return instance;
}

export default {
    getInstance,
    identities: {
        SPONSOR_IDENTITY,
        HCO_IDENTITY,
        PATIENT_IDENTITY
    }
};