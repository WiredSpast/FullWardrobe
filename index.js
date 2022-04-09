const { app, BrowserWindow, ipcMain } = require('electron');
const fetch = require('node-fetch');

process.on('uncaughtException', function (error) {
    console.error(error);
    process.exit(0);
});

let win;

let realFigureSetIdsPacket;
let fullFigureSetIdsPacket;
let enabled = false;

const extensionInfo = {
    name: 'Full Wardrobe',
    description: 'Have optional access to all clothing in the wardrobe',
    version: '0.4',
    author: 'WiredSpast'
}

app.whenReady().then(async () => {
    const { Extension, HDirection, HPacket} = await import('gnode-api');

    const ext = new Extension(extensionInfo);

    ext.run();

    ext.on('socketdisconnect', () => {
        process.exit(0);
    });

    ext.interceptByNameOrHash(HDirection.TOCLIENT, 'FigureSetIds', onFigureSetIds);
    ext.interceptByNameOrHash(HDirection.TOSERVER, 'UpdateFigureData', onUpdateFigureData);

    ext.on('click', () => {
        win.show();
    });

    ext.on('connect', (host, connectionPort, hotelVersion, clientIdentifier, clientType) => {
        switch(host) {
            case 'game-br.habbo.com':
                fetchFigureSetIds('www.habbo.com.br');
                break;
            case 'game-de.habbo.com':
                fetchFigureSetIds('www.habbo.de');
                break;
            case 'game-es.habbo.com':
                fetchFigureSetIds('www.habbo.es');
                break;
            case 'game-fi.habbo.com':
                fetchFigureSetIds('www.habbo.fi');
                break;
            case 'game-fr.habbo.com':
                fetchFigureSetIds('www.habbo.fr');
                break;
            case 'game-it.habbo.com':
                fetchFigureSetIds('www.habbo.it');
                break;
            case 'game-nl.habbo.com':
                fetchFigureSetIds('www.habbo.nl');
                break;
            case 'game-s2.habbo.com':
                fetchFigureSetIds('sandbox.habbo.com');
                break;
            case 'game-tr.habbo.com':
                fetchFigureSetIds('www.habbo.com.tr');
                break;
            case 'game-us.habbo.com':
                fetchFigureSetIds('www.habbo.com');
                break;
            default:
                fullFigureSetIdsPacket = undefined;
                break;
        }
    });

    function fetchFigureSetIds(hotel) {
        fetch(`https://${hotel}/gamedata/furnidata_json/1`)
            .then(res => res.json())
            .then(furniData => {
                let clothing = furniData.roomitemtypes.furnitype.filter(i => i.specialtype === 23 && i.customparams != null);

                let ids = '';
                let names = '';
                let count = 0;

                for(let item of clothing) {
                    for(let param of item.customparams.split(',')) {
                        if(param !== "") {
                            count++;
                            param = param.trim();
                            ids += `{i:${param}}`;
                            names += `{s:"${item.classname}"}`;
                        }
                    }
                }

                fullFigureSetIdsPacket = new HPacket(`{in:FigureSetIds}{i:${count}}${ids}{i:${count}}${names}`);
            });
    }

    win = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        width: 244,
        height: 230,
        fullscreenable: false,
        resizable: false,
        autoHideMenuBar: true,
        show: false,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        icon: 'icon.png'
    });

    win.loadFile('index.html');

    win.on('close', e => {
        e.preventDefault();
        win.hide();
    });
});

ipcMain.on('hide', (e, args) => {
    win.hide();
});

function onFigureSetIds(hMessage) {
    realFigureSetIdsPacket = hMessage.getPacket();
    enabled = false;
    win.webContents.send('buttonState', enabled);
}

function onUpdateFigureData(hMessage) {
    let packet = hMessage.getPacket();
    let gender = packet.readString();
    let figure = packet.readString();
    if(win) {
        win.webContents.send('currentOutfit', figure);
    }
}

ipcMain.on('toggle', (e, arg) => {
    if(fullFigureSetIdsPacket) {
        enabled = !enabled;

        if (enabled) {
            ext.sendToClient(fullFigureSetIdsPacket);
        } else {
            if(realFigureSetIdsPacket) {
                ext.sendToClient(realFigureSetIdsPacket);
            } else {
                enabled = true;
            }
        }

        win.webContents.send('buttonState', enabled);
    }
});
