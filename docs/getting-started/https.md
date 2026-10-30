# Using Prism over https at home

Browsers only allow some features on a **secure page**: one opened over `https://`, or from `localhost` on the same machine. Opened over a plain `http://` address such as `http://<server-ip>:3000`, Prism works, but the browser turns these off before Prism can use them:

- the on-screen keyboard's **microphone**
- **barcode scanning** with the camera in Shopping
- **copy buttons** (layout Export, API tokens, the Kroger redirect URI)
- **installing Prism as an app** from Chrome or Edge

Prism shows a notice at the top of Settings when it is opened over `http://`. Nothing in Prism can switch these back on; the address has to change. The ways to do that, easiest first:

## Tailscale

[Tailscale](https://tailscale.com) gives the server a name with a real certificate, so no certificate handling is needed.

1. Install Tailscale on the server running Prism and on every device that opens Prism, including the wall display, all signed in to the same account.
2. In the Tailscale admin console, under **DNS**, turn on **MagicDNS** and **HTTPS Certificates**.
3. On the server, run:

    ```bash
    tailscale serve --bg 3000
    ```

4. Open the address it prints, `https://<server-name>.<your-tailnet>.ts.net`, on each device.

The catch: every device that opens Prism needs Tailscale running.

## A reverse proxy with a real certificate

If you own a domain name, a reverse proxy can get a trusted certificate for it automatically, even for a server only reachable at home. It proves you own the domain through your DNS provider (a **DNS challenge**), so nothing has to be opened to the internet.

- **[Caddy](https://caddyserver.com)** with the plugin for your DNS provider, or
- **[Nginx Proxy Manager](https://nginxproxymanager.com)**, which has a web page for requesting the certificate. It also runs as a Home Assistant add-on.

Then add a record on your home network's DNS (often in the router, or in Pi-hole or AdGuard) pointing a name such as `prism.example.com` at the server, and open Prism at `https://prism.example.com`.

Prism's own Compose file already puts Nginx in front with TLS on port 443 (see [Install](install.md#https-nginx-certificate-prerequisite-linux-wsl)). With the self-signed certificate from that guide, every device shows a warning until the certificate is installed and trusted on it, which is why the options above are easier.

## Home Assistant add-on

Opening Home Assistant over `https://` (through Nabu Casa or your own certificate) does not make Prism secure: the add-on is reached on its own port, over `http://`. A browser also will not show an `http://` Prism inside an `https://` Home Assistant page. Give Prism its own `https://` address with one of the options above; then it can be shown in Home Assistant as a [Webpage dashboard](../home-assistant.md).

## A single kiosk display

If the only thing that needs these features is one dedicated display running Chromium, Chromium can be told to treat one `http://` address as secure. Start it with both flags:

```bash
chromium --unsafely-treat-insecure-origin-as-secure=http://<server-ip>:3000 \
  --user-data-dir=$HOME/.prism-kiosk
```

This changes only that browser on that device. Every other device still needs one of the options above.
