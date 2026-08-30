# IRE profiles (`ire-id`)

Every `ire1` can inscribe a public profile: display name plus social handles, then share the address to receive or send.

Live form: `/id/`. Share link: `/id/?a=<ire1>`. Receive/send: `/wallet/?a=<ire1>`.

## Memo

```
IREINSCRIBE1 application/json {"p":"ire-id","op":"set","n":"name","x":"handle","tg":"user","d":"discord","w":"site.com"}
```

Carrier: self-send `1uire` with `--note` (this binary does not take `--memo`). Keep the whole memo ≤ 256 characters.

Latest `op:set` from that address in the scan window is what `/id/` shows. History stays on chain.

Do not inscribe emails, phones, or secrets. Profiles are public.
