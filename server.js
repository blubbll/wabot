///////////////////////////////////////////////////////////////////////////
//DEPLOY
///////////////////////////////////////////////////////////////////////////
(async () => {
  const script = "!.glitch-deploy.js";
  if (process.env.PROJECT_DOMAIN) {
    const deployfile = ":deploying:";
    /*require("download")(
      "https://raw.githubusercontent.com/blubbll/glitch-deploy/master/glitch-deploy.js",
      __dirname,
      {
        filename: script
      }
    ).then(() => {
      deployProcess();
    });*/

    const deployProcess = async () => {
      const deploy = require(`./${script}`);
      const deployCheck = async () => {
        //console.log("🐢Checking if we can deploy...");
        if (fs.existsSync(`${__dirname}/${deployfile}`)) {
          console.log("🐢💥Deploying triggered via file.");
          fs.unlinkSync(deployfile);
          await deploy({
            ftp: {
              password: process.env.DEPLOY_PASS,
              user: process.env.DEPLOY_USER,
              host: process.env.DEPLOY_HOST
            },
            clear: 0,
            verbose: 1,
            env: 1
          });
          require("request")(
            `https://evennode-reboot.eu-4.evennode.com/reboot/${process.env.DEPLOY_TOKEN}/${process.env.PROJECT_DOMAIN}`,
            (error, response, body) => {
              console.log(error || body);
            }
          );
          require("child_process").exec("refresh");
        } else setTimeout(deployCheck, 9999); //10s
      };
      setTimeout(deployCheck, 999); //1s
    };
    deployProcess();
  } else require(`./${script}`)({ env: true }); //apply env on deployed server
})();

const express = require("express"),
  app = express(),
  fs = require("fs"),
  puppeteer = require("puppeteer"),
  path = require("path"),
  spinner = require("./step"),
  utils = require("./utils"),
  qrcode = require("qrcode-terminal");

//glitch-active
app.get("/ping", (req, res) => {
  res.json("pong");
});

const restart = () => {
  //restart on exit
  process.on("exit", () => {
    require("child_process").spawn(process.argv.shift(), process.argv, {
      cwd: process.cwd(),
      detached: true,
      stdio: "inherit"
    });
  });
  process.exit();
};

app.get(`/restart/${process.env.BRIDGE_TOKEN}`, (req, res) => {
  res.json(`restarted tgbot [${process.env.VERSION}]`);
  restart();
});

const wa = {
  checkLogin: async page => {
    spinner.start("Seite lädt...");
    await utils.delay(10000);
    //await page.waitForNavigation({ waitUntil: "networkidle0" });
    //sind wir schon eingeloggt?
    const output = await page.evaluate("localStorage['last-wid']");
    if (output) {
      spinner.stop("Wir sind schon eingeloggt...");
      await wa.injectScripts(page);
    } else {
      spinner.info(
        "Wir sind nicht eingeloggt... Bitte scanne den folgenden QR-Code:"
      );
    }
    return output;
  },
  injectScripts: async page => {
    const _in = `${__dirname}/inject`;
    return await page
      //.waitForSelector("[data-asset-intro-image]") //,  {timeout: 60000})
      .waitForSelector("[draggable]", { timeout: 30000 })
      //.waitForSelector("[data-animate-modal-body]", { timeout: 30 * 1000 })
      .catch(async e => {
        console.error(e);
        restart();
      })
      .then(async () => {
        //inject node-vars
        page.evaluate(
          (a, b) => {
            (window.TGB_HOST = a), (window.BRIDGE_TOKEN = b);
          },
          process.env.TGB_HOST,
          process.env.BRIDGE_TOKEN
        );

        let filepath = path.join(_in, "WAPI.js");
        await page.addScriptTag({ path: require.resolve(filepath) });
        filepath = path.join(_in, "inject.js");
        await page.addScriptTag({ path: require.resolve(filepath) });
        return true;
      })
      .catch(e => {
        console.warn(e);
      });
  },

  getAndShowQR: async page => {
    var scanme = "canvas";
    await page.waitForSelector(scanme);
    await page.evaluate(
      `document.querySelector("[name=rememberMe]").checked=true;`
    );
    var imageData = await page.evaluate(
      `document.querySelector("${scanme}").parentElement.getAttribute("data-ref")`
    );

    qrcode.generate(imageData, { small: true });
    var isLoggedIn = await wa.injectScripts(page);
    while (!isLoggedIn) {
      await utils.delay(300);
      isLoggedIn = await wa.injectScripts(page);
    }
    if (isLoggedIn) {
      spinner.stop("Wir sind jetzt eingeloggt.");
    }
  }
};
[
  //app.get("/", async (request, response) => {
  process.env.ACTIVE !== "false" &&
    (async () => {
      try {
        const WHATSAPP_WEB_URL = "https://web.whatsapp.com";
        spinner.start("starte Chrome");
        /*const browserFetcher = puppeteer.createBrowserFetcher();
        const revisionInfo = await browserFetcher.download("737173");
        const browser = await puppeteer.launch({
          executablePath: revisionInfo.executablePath,*/
        const browser = await puppeteer.launch({
          args: [
            `--app=${WHATSAPP_WEB_URL}`,
            "--disable-gpu",
            "--renderer",
            "--no-sandbox",
            "--no-service-autorun",
            "--no-experiments",
            "--no-default-browser-check",
            "--disable-webgl",
            "--disable-threaded-animation",
            "--disable-threaded-scrolling",
            "--disable-in-process-stack-traces",
            "--disable-histogram-customizer",
            "--disable-gl-extensions",
            "--disable-extensions",
            "--disable-composited-antialiasing",
            "--disable-canvas-aa",
            "--disable-3d-apis",
            "--disable-accelerated-2d-canvas",
            "--disable-accelerated-jpeg-decoding",
            "--disable-accelerated-mjpeg-decode",
            "--disable-app-list-dismiss-on-blur",
            "--disable-accelerated-video-decode",
            "--num-raster-threads=1"
          ],
          devtools: 0,
          headless: 1,
          userDataDir: `${__dirname}/.data/chromium-data_${process.env.VERSION}`
        });

        spinner.stop("Chrome wurde gestartet.");
        spinner.start("öffne WhatsApp...");
        const pages = await browser.pages();
        if (pages.length === 0) return;
        const page = pages[0];
        page.setUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.103 Safari/537.36"
        );
        page.setBypassCSP(true);
        await page.goto(WHATSAPP_WEB_URL, {
          waitUntil: "networkidle0",
          timeout: 0
        });

        spinner.stop("WhatsApp wurde geöffnet.");
        !(await wa.checkLogin(page)) && (await wa.getAndShowQR(page));

        spinner.info(`Bot ist an. Version: [${process.env.VERSION}].`);
      } catch (error) {
        console.log(error);
      }
    })()
];

var listener = app.listen(process.env.PORT, function() {
  console.log("Your app is listening on port " + listener.address().port);
});

//HEALTH WATCHER + RESTART
/*{
  const os = require("os"),
    { spawn } = require("child_process"),
    v8 = require("v8");

  const restartProcess = () => {
    process.on("exit", function() {
      require("child_process").spawn(process.argv.shift(), process.argv, {
        cwd: process.cwd(),
        detached: true,
        stdio: "inherit"
      });
    });
    process.exit();
  };

  setInterval(() => {
    const stat = v8.getHeapStatistics();

    if (stat.used_heap_size >= stat.heap_size_limit) {
      console.warn("MEMORY PROBLEM");
      restartProcess();
    }
  }, 9999);
}
*/
