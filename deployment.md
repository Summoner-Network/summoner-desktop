### Instructions to publish a release:

1. **Commit & push** this workflow file.

2. In GitHub ➜ **Actions** ➜ select **Build & Release (mac + linux)** ➜ **Run workflow**.

3. Wait for the three jobs to finish.

4. Go to **Releases**: 
    - if you end up in the "Releases / New release" section, click on "Release"
    - you'll see a **draft release** named `Summoner Desktop v1.0.0-alpha.2` with assets:

        * macOS:

            * `Summoner Desktop-1.0.0-alpha.2-arm64.dmg` and `.zip`
            * `Summoner Desktop-1.0.0-alpha.2-x64.dmg` and `.zip`
        * Linux:

            * `Summoner Desktop-1.0.0-alpha.2-x86_64.AppImage`
            * `Summoner Desktop-1.0.0-alpha.2-x64.deb` *(you can optionally rename to `-amd64.deb`)*

5. Publish the draft when you're ready. Link these files from our website.

### How to link from our website

After publishing, each asset has a permanent URL of the form:

```
https://github.com/Summoner-Network/summoner-desktop/releases/download/untagged-<uuid>/<FILENAME>
```

Examples (filenames depend on what your build produced):

* macOS Apple Silicon: `…/Summoner Desktop-1.0.0-alpha.2-arm64.dmg`
* macOS Intel: `…/Summoner Desktop-1.0.0-alpha.2-x64.dmg`
* Linux AppImage: `…/Summoner Desktop-1.0.0-alpha.2-x86_64.AppImage`

