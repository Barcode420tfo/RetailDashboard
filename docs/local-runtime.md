# Local runtime

MongoDB Community Server 7.0.43 for macOS x86_64 is installed and verified for this project.
The selected archive comes from MongoDB's official release manifest:

- Manifest: https://downloads.mongodb.org/current.json
- Archive: https://fastdl.mongodb.org/osx/mongodb-macos-x86_64-7.0.43.tgz
- SHA-256: `9a939ec78ddbb60cb1f36f0c5f6591964087d59ba8108ca0391de64421577c8c`

MongoDB 8.0.32 was tested first, but its macOS binary requires macOS 14 and cannot
start on this Mac's macOS 13.0.1. The current 7.0 patch is used for compatibility.

The archive is verified against that checksum before extraction. Executables live
in `.local/mongodb/bin`; data and logs remain inside `.local/mongodb`. No Homebrew,
Docker, global npm install, or system-wide MongoDB service is required.

On another computer, install the appropriate MongoDB Community Server for that
operating system or point `.env` at Atlas. The local helper assumes the supplied
macOS binary and a free port 27017. It initializes a single-node replica set to
enable database transactions; this does not provide production redundancy.

Installation references: [MongoDB Community](https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-os-x-tarball/),
[Vite](https://vite.dev/guide/), and [Tailwind Vite integration](https://tailwindcss.com/docs/installation/using-vite).

ExcelJS uses a scoped UUID override (`^11.1.1`) to avoid the advisory affecting its
older transitive dependency. A workbook round-trip test exercises extended data-bar
formatting, including UUID generation, to check this override's compatibility.

Verified on this Mac: seven offline tests pass, frontend production build passes,
all 14 model index definitions exist in MongoDB, duplicate-key writes are rejected,
and transaction rollback leaves no verification records. The frontend proxy health
request returns `{"status":"ok","database":"connected"}`. The installation audit
reported zero known npm vulnerabilities.
