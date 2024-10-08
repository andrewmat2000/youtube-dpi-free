// main.js

// https://www.electronforge.io/config/makers/squirrel.windows


if (require('electron-squirrel-startup')) return;

const net = require("net")
const fs = require("fs")

function checkPort(port) {
    return new Promise((resolve) => {
        const server = net.createServer();

        server.on("error", () => { resolve(false) })
        server.on("listening", () => {
            server.close();
            resolve(true);
        })

        server.listen(port);
    })
}

async function getPort() {
    let port = 8080;

    do {
        console.log(`Checking '${port}' port.`);

        if (await checkPort(port)) {
            console.log(`Port '${port}' is available.`);

            break;
        } else {

            console.log(`Port '${port}' is not available, checking next.`);
        }

    } while (port++ < 65535);

    return port;
}


getPort().then((port) => {
    process.env.DEMERGI_ADDRS = `[::]:${port}`;

    require("./demergi.js")

    const { app, shell, session, BrowserWindow, Menu, Tray, nativeImage, dialog } = require('electron')
    const { getHA, setHA } = require('./settings.js');

    console.log(`Setting proxy to ${port}.`);
    app.commandLine.appendSwitch("proxy-server", `http://localhost:${port}`);

    // Disable Hardware Acceleration
    // https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering
    if (!getHA()) {
        app.disableHardwareAcceleration()
    }

    createWindow = () => {
        /** @type {Electron.Rectangle & {isMaximized: boolean, isFullScreen: boolean}} */
        let bounds = undefined;

        try {
            bounds = JSON.parse(fs.readFileSync(".start-info", 'utf-8'));
        
        } catch (e) {
            console.log("Can not read start info.")
            console.log(e)
        }

        const win = new BrowserWindow({
            width: bounds?.width ?? 1280,
            height: bounds?.height ?? 720,
            x: bounds?.x,
            y: bounds?.y,
            fullscreen: bounds?.isFullScreen ?? false,
            title: 'YouTube Dpi Free',
            icon: __dirname + '/images/YouTube.ico',
            autoHideMenuBar: true,
            webPreferences: {
                webSecurity: true,
                contextIsolation: true,
                webviewTag: true,
                nodeIntegration: true,
                nativeWindowOpen: true
            }
        });

        if(bounds?.isMaximized) {
            win.maximize()
        }

        win.loadURL(`https://www.youtube.com`);

        // Create a Cookie, so that Theater Mode is allways enabled.
        // https://www.electronjs.org/docs/latest/api/cookies
        // http://blog.ercanopak.com/how-to-make-theater-mode-the-default-for-youtube/
        // https://medium.com/swlh/building-an-application-with-electron-js-part-2-e62c23e4eb69
        const cookie = { url: 'https://www.youtube.com', name: 'wide', value: '1' }
        session.defaultSession.cookies.set(cookie)
            .then(() => {
                // success
            }, (error) => {
                console.error(error)
            })

        // Open links with External Browser
        // https://stackoverflow.com/a/67409223
        win.webContents.setWindowOpenHandler(({ url }) => {
            shell.openExternal(url);
            return { action: 'deny' };
        });

        let tray = null
        const icon = nativeImage.createFromPath(__dirname + '/images/YouTube.ico')
        tray = new Tray(icon)

        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Hardware Acceleration',
                type: 'checkbox',
                checked: getHA(),
                click({ checked }) {
                    setHA(checked)
                    dialog.showMessageBox(
                        null,
                        {
                            type: 'info',
                            title: 'info',
                            message: 'Exiting Applicatiom, as Hardware Acceleration setting has been changed...'
                        })
                        .then(result => {
                            if (result.response === 0) {
                                app.relaunch();
                                app.exit()
                            }
                        }
                        )
                }
            },
            {
                label: "Remove current window state",
                click: () => {
                    try {
                        fs.unlinkSync(".start-info")
                    } catch {}
                    app.relaunch();
                    app.exit();
                }
            },
            {
                label: 'Clear Cache',
                click: () => {
                    session.defaultSession.clearStorageData()
                    app.relaunch();
                    app.exit();
                }
            },
            {
                label: 'Reload',
                click: () => win.reload()
            },
            {
                label: 'Quit',
                type: 'normal',
                role: 'quit'
            }
        ])

        tray.setToolTip('YouTube Dpi Free')
        tray.setTitle('YouTube Dpi Free')
        tray.setContextMenu(contextMenu)

        return win;
    };

    app.whenReady().then(() => {
        const window = createWindow()

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow()
            }
        })

        window.on("close", () => {
            try {
                const bounds = window.getBounds();
                bounds.isMaximized = window.isMaximized();
                bounds.isFullScreen = window.isFullScreen();
                fs.writeFileSync('.start-info', JSON.stringify(bounds), { encoding: "utf-8" });
                console.log("Bounds saved to file.");
            }
            catch (e) {
                console.log('Failed to save the file !');
                console.log(e)
            }
        })
    })

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit()
        }
    })
});