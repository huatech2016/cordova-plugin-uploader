function createEvent(name, data) {
    data = data || [];
    var event = document.createEvent("Event");
    event.initEvent(name);
    event.name = name;
    event.data = data;
    var log = name;
    if (data[0]) log += " : " + data[0];
    //console.log("FIRE "+ log);
    return event;
};

var Uploader = {
    localFolder: null,
    fileSystemURL: null,
    fileSystem: null,
    uploadQueue: [],
    fileObjects: [],
    fileObjectInProgress: null,
    fileObjectInUnzipProgress: null,
    wifiOnly: false,
    loading: false,
    unzipping: false,
    initialized: false,
    transfer: null,
    retry: 1,
    initialize: function (options) {
        //Uploader.setFolder(options.folder);
        if (typeof options.wifiOnly != 'undefined') {
            Uploader.setWifiOnly(options.wifiOnly);
        }

        if (typeof options.fileSystem != 'undefined') {
            Uploader.fileSystemURL = options.fileSystem;
        }
        document.addEventListener("uploaderUploadError", Uploader.onUploaderror, false);
        document.addEventListener("uploaderUploadloadSuccess", Uploader.onUploadloadSuccess, false);




    },
    load: function (fileURL, server, options) {
        //var fileName = fileName || null;
        var fileObject = {
            fileURL: fileURL,
            server: server,
            options: options
        };
        Uploader.uploadQueue.push(fileObject);

        if (!Uploader.isLoading()) {
            Uploader.upLoadNextInQueue();
        }
        return fileObject.name;
    },

    /**
     * Aborts current in-progress transfer and empties the queue
     */
    abort: function () {
        if (Uploader.transfer !== null) {
            Uploader.transfer.abort();
            Uploader.transfer = null;
        }
        Uploader.reset();
    },


    upLoadNextInQueue: function () {
        if (Uploader.uploadQueue.length > 0) {
            Uploader.loading = true;
            fileObject = Uploader.uploadQueue.shift();
            Uploader.fileObjectInProgress = fileObject;
            Uploader.uploadFile(fileObject);
            return true;
        }
        return false;
    },


    /**
     * @param {FileObject} fileObject
     */
    uploadFile: function (fileObject) {
        Uploader.transfer = new FileTransfer();
        Uploader.transfer.onprogress = function (progressEvent) {
            if (progressEvent.lengthComputable) {
                var percentage = Math.floor(progressEvent.loaded / progressEvent.total * 100);
                document.dispatchEvent(createEvent("uploaderUploadloadProgress", [percentage, fileObject.name]));
            }
        };

        Uploader.transfer.upload(fileObject.fileURL, fileObject.server,
            function (entry) {
            // console.log("uploadFile, succcess file name: " + Uploader.fileObjectInProgress.name);
            document.dispatchEvent(createEvent("uploaderUploadloadSuccess"));
        },
            function (error) {
            // console.log("uploadFile, error file name: " + Uploader.fileObjectInProgress.name);
            document.dispatchEvent(createEvent("uploaderUploadError"));
        },
            fileObject.options    );
    },


    /**
     * compare md5sum of fileName with md5
     * @param {String} fileName
     * @param {String} md5
     */




    /*************************************************************** state */

    /**
     * returns true if a Uploadload is in progress
     * @returns {boolean}
     */
    isLoading: function () {
        return Uploader.loading;
    },


    /**
     * returns true if wifiOnly is set
     * @returns {boolean}
     */
    isWifiOnly: function () {
        return Uploader.wifiOnly;
    },

    isWifiConnection: function () {
        var networkState = navigator.connection.type;
        if (networkState == Connection.WIFI) {
            return true;
        }
        return false;
    },


    /*************************************************************** setter */

    /**
     * sets the Folder for storing the Uploadloads
     * @param {cordova-plugin-file.FileEntry} folder
     */
    setFolder: function (folder) {
        Uploader.localFolder = folder;
    },

    /**
     * sets if it only possible to Uploadload on wifi (not on mobile connection)
     * @param {boolean} wifionly
     */
    setWifiOnly: function (wifionly) {
        Uploader.wifiOnly = wifionly;
    },


    /**
     * resets status-variables to get a fresh Uploader after error
     */
    reset: function () {
        //console.log("resetting");
        Uploader.uploadQueue = [];
        Uploader.fileObjects = [];
        Uploader.fileObjectInProgress = null;

        Uploader.initialized = false;
        Uploader.loading = false;
        Uploader.retry = 1;
    },

    /*************************************************************** getter */

    getFilesystem: function () {
        if (Uploader.fileSystemURL) {
            //console.log("Using fileSystemURL:" + Uploader.fileSystemURL);
            window.resolveLocalFileSystemURI(Uploader.fileSystemURL, function (rootfolder) {
                document.dispatchEvent(createEvent("uploadergotFileSystem", [rootfolder]));
            }, function (error) {
                document.dispatchEvent(createEvent("uploadererror", [error]));
            });
        } else {
            //console.log("Fallback to Persistant Filesystem");
            window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
            window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function (fileSystem) {
                document.dispatchEvent(createEvent("uploadergotFileSystem", [fileSystem.root]));
            }, function (error) {
                document.dispatchEvent(createEvent("uploadererror", [error]));
            });
        }
    },


    // getFolder: function (fileSystem, folderName) {
    //     fileSystem.getDirectory(folderName, {
    //         create: true,
    //         exclusive: false
    //     }, function (folder) {
    //         //console.log("getFolder->Success:" + folder.fullPath + " : " + folder.name);
    //         document.dispatchEvent(createEvent("uploadergotFolder", [folder]));
    //     }, function (error) {
    //         //console.log("getFolder->Error");
    //         document.dispatchEvent(createEvent("uploadererror", [error]));
    //     });
    // },

    /*************************************************************** EventHandler */

    /**
     * @param {Object} event
     */
    onUploadloadSuccess: function (event) {
        var entry = /** @type {cordova-plugin-file.FileEntry} */ event.data[0];

        if (!Uploader.upLoadNextInQueue()) {
            Uploader.loading = false;
            Uploader.fileObjectInProgress = null;
        }
        // reset retry counter;
        Uploader.retry = 1;
    },
    /**
     * @param {Object} event
     */
    onUploaderror: function (event) {
        if (Uploader.retry > 0) {
            // console.log("onUploaderror, retry: " + Uploader.retry);
            Uploader.uploadFile(Uploader.fileObjectInProgress);
            Uploader.retry--;
        } else {
            Uploader.reset();
            //console.log("onUploaderror remove listener");
            document.removeEventListener("uploaderonUploaderror", Uploader.onUploaderror, false);
            document.removeEventListener("uploadergotFileSystem", Uploader.onGotFileSystem, false);
            document.removeEventListener("uploadergotFolder", Uploader.onGotFolder, false);
            document.removeEventListener("uploaderUploadloadSuccess", Uploader.onUploadloadSuccess, false);
            document.removeEventListener("uploaderfileCheckSuccess", Uploader.onCheckSuccess, false);
        }
    },

    /*************************************************************** API */

    interface: {
        obj: null,

        /**
         * initializes the Uploader
         * @param {Object} options
         *   - folder: sets folder to store Uploadloads [required]
         *   - unzip: true -> unzip after Uploadload is enabled [default: false]
         *   - check: true -> md5sum of file is checked after Uploadload [default: false]
         *   - remove: true -> remove after unpack a zipfile [default: true]
         *   - wifiOnly: true -> only Uploadload when connected to Wifi, else fire "uploadernoWifiConnection" event [default: false]
         */
        init: function (options) {
            // if (!options.folder) {
            //   console.error("You have to set a folder to store the Uploadloaded files into.");
            //   return;
            // }
            options = options || {};
            Uploader.initialize(options);
            Uploader.interface.obj = Uploader;
        },


        get: function (fileURL, server, options) {
            // if (!Uploader.isInitialized()) {
            //     //console.log("wait for initialization");
            //     document.addEventListener("DOWNLOADER_initialized", function onInitialized(event) {
            //         //console.log("initialization done");
            //         event.target.removeEventListener("DOWNLOADER_initialized", onInitialized, false);
            //         Downloader.load(url, fileName);
            //     }, false);
            //     return;
            // }
            if (!fileURL) {
                console.error("You have to specify fileURL url where the file is located you wanna Uploadload");
                return;
            }
            if (Uploader.isWifiOnly() && !Uploader.isWifiConnection()) {
                document.dispatchEvent(createEvent("uploadernoWifiConnection"));
                return;
            }
            return Uploader.load(fileURL, server, options);
        },
        /**
         * Uploadloads multiple Files in a row
         * UploadloadObject:{
       *   url: sourceURL for Uploadload,
       *   md5: md5sum of file to compare with, or null for no compare
       * }
         * @param {Array.<UploadloadObject>} list
         */
        uploadMultipleFiles: function (list) {
            if (Uploader.isWifiOnly() && !Uploader.isWifiConnection()) {
                document.dispatchEvent(createEvent("uploadernoWifiConnection"));
                return;
            }
            for (var i = 0; i < list.length; i++) {
                var fileObject = list[i];
                //上传文件前要确认路径是否真实有效
                Uploader.load(fileObject);
               // beforeUpload(fileObject);

            }
            //检查文件路径的，弃用，在filetransfer 的faiil callback 里处理
            // function beforeUpload(fileObject){
            //     window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function(fileSystem){
            //         fileSystem.root.getFile(path, { create: false }, fileExists, fileDoesNotExist);
            //     }, getFSFail);
            //     function fileExists(fileEntry){
            //         console.log("File " + fileEntry.fullPath + " exists!");
            //         Uploader.load(fileObject);
            //     }
            //     function fileDoesNotExist(){
            //         console.log("file does not exist");
            //         document.dispatchEvent(createEvent("fileCheckFail"));
            //     }
            //     function getFSFail(evt) {
            //         console.log(evt.target.error.code);
            //         document.dispatchEvent(createEvent("fileCheckFail"));
            //     }
            // }

        },
        abort: function () {
            Uploader.abort();
        },

        setWifiOnly: function (wifionly) {
            Uploader.setWifiOnly(wifionly);
        }
    }
};

module.exports = Uploader.interface;
