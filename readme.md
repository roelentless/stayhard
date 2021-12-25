# Stay Hard

Browser extension to stay away from addictive time-wasting non-productive sites

## Personalities

The personality defines the tone, character, charisma and aggressiveness of the extension.

The default Goggins personality has been tuned for maximal effectiveness.

If that is not your cup of tea, you can create your own personality in the settings of the extension (and also share it with the community).

### Contributing personalities

See examples in [personalities/](./personalities).

Create a pull request with the content of the settings `personality` field in a file in `personalities/*.json`. Pretty-printed JSON only.

Then others can import it as well.

Popular personalities will be included in the extension over time.

## Dev

Manifest V3 is used. Keep it simple.

### Release build
```
yarn build
```

### Dev mode auto rebuild
```
yarn dev
```

Running http://test.stayhard:8080/ test site for fast local dev:
1.  Once, add `127.0.0.1 test.stayhard` to your `/etc/hosts`
2.  Run `npx http-server testsite` to serve the index file

### Info

-  Manifest:  https://developer.chrome.com/docs/extensions/mv3/manifest/
-  Messaging: https://developer.chrome.com/docs/extensions/mv3/messaging/#simple