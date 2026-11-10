# Using https at home

Some features, such as the microphone and the barcode camera, only work when Prism is opened over https.

Browsers allow some features only on a secure page, meaning one opened over `https://` or from `localhost` on the same machine. Prism still works over a plain `http://` address such as `http://<server-ip>:3000`, but the browser turns these off before Prism can use them:

- the on-screen keyboard's microphone
- barcode scanning with the camera in Shopping
- copy buttons (layout **Export**, API tokens and the Kroger redirect URI)
- installing Prism as an app from Chrome or Edge

When Prism is opened over `http://`, it shows a notice at the top of Settings. No setting in Prism can switch these back on, because the address itself has to change. The sections below show ways to do that, starting with the easiest.

## Tailscale

[Tailscale](https://tailscale.com) gives the server a name with a real certificate, so you never handle a certificate yourself.

1. Install Tailscale on the server running Prism and on every device that opens Prism, including the wall display, all signed in to the same account.
2. In the Tailscale admin console, under **DNS**, turn on **MagicDNS** and **HTTPS Certificates**.
3. On the server, run:

    ```bash
    tailscale serve --bg 3000
    ```

4. Open the address it prints, `https://<server-name>.<your-tailnet>.ts.net`, on each device.

The downside is that every device that opens Prism needs Tailscale running.

## A reverse proxy with a real certificate

A reverse proxy is a small web server that sits in front of Prism and handles https for it. If you own a domain name, a reverse proxy can get a trusted certificate for it on its own, even when the server is only reachable at home. It proves you own the domain through your DNS provider (this is called a DNS challenge), so you do not have to open anything to the internet. Two reverse proxies can do this:

- [Caddy](https://caddyserver.com), with the plugin for your DNS provider
- [Nginx Proxy Manager](https://nginxproxymanager.com), which has a web page for requesting the certificate and also runs as a Home Assistant add-on

Then add a record to your home network's DNS (usually in the router, or in Pi-hole or AdGuard) that points a name such as `prism.example.com` at the server, and open Prism at `https://prism.example.com`.

Prism's own Compose file already puts Nginx in front with TLS on port 443 (see [Install](install.md#https-nginx-certificate-prerequisite-linux-wsl)). With the self-signed certificate from that guide, though, every device shows a warning until you install the certificate on it and trust it. The options above save you that step on each device.

## Home Assistant add-on

Opening Home Assistant over `https://` (through Nabu Casa or your own certificate) leaves Prism on plain `http://`, because the add-on is reached on its own port. A browser also refuses to show an `http://` Prism inside an `https://` Home Assistant page. Give Prism its own `https://` address with one of the options above, and you can then show it in Home Assistant as a [Webpage dashboard](../home-assistant.md).

## A single kiosk display

If the only device that needs these features is one display running Chromium, you can tell Chromium to treat one `http://` address as secure. Start it with both of these flags:

```bash
chromium --unsafely-treat-insecure-origin-as-secure=http://<server-ip>:3000 \
  --user-data-dir=$HOME/.prism-kiosk
```

This changes only that browser on that one device. Every other device still needs one of the options above.
