var file_datatable = null;
$(document).ready(function () {
    toastr.options = {
        "closeButton": true,
        "debug": false,
        "newestOnTop": false,
        "progressBar": false,
        "positionClass": "toast-top-right",
        "preventDuplicates": false,
        "onclick": null,
        "showDuration": "300",
        "hideDuration": "1000",
        "timeOut": "5000",
        "extendedTimeOut": "1000",
        "showEasing": "swing",
        "hideEasing": "linear",
        "showMethod": "fadeIn",
        "hideMethod": "fadeOut"
    };

    var timezone = jstz.determine();
    $("#time_zone_name").val(timezone.name());

    DatatableAutoColumnHideDemo.init();
    initFileUploader();

    $("#id_btnNewFile").click(function() {
        $("#id_textDescription").val('');
        $("#files").empty();
        $("#files").append('<li class="text-muted text-center empty">No files uploaded.</li>');
    });
    $(document).on('click', '.class_btnDownload', function() {
        if($("is"))
        $("#id_btnOpenDownloadModal").click();
    });
});

var DatatableAutoColumnHideDemo = function() {
    //== Private functions

    // basic demo
    var downloadTdWidth = 130;
    var downloadTdString = 'Download';
    if($("#id_isAdmin").val() == '1') {
        downloadTdWidth = 175;
        downloadTdString = 'Action';
    }
    var demo = function() {

        file_datatable = $('.m_datatable').mDatatable({
            // datasource definition
            data: {
                type: 'remote',
                source: {
                    read: {
                        url: '/getFileList',
                        params: {
                            query: {
                                time_zone_name: $("#time_zone_name").val()
                            }
                        }
                    },
                },
                pageSize: 10,
                saveState: false,
                serverPaging: true,
                serverFiltering: true,
                serverSorting: true,
            },

            // column sorting
            sortable: true,

            pagination: true,

            toolbar: {
                // toolbar items
                items: {
                    // pagination
                    pagination: {
                        // page size select
                        pageSizeSelect: [10, 20, 30, 50, 100],
                    },
                },
            },

            search: {
                input: $('#generalSearch'),
                onEnter: true
            },

            rows: {
                // callback: function() {},
                // auto hide columns, if rows overflow. work on non locked columns
                autoHide: false,
            },

            layout: {
                theme: 'default',
                class: 'm-datatable--brand',
                scroll: true,
                height: null,
                footer: false,
                header: true,

                smoothScroll: {
                    scrollbarShown: true
                },

                // spinner: {
                //     overlayColor: '#000000',
                //     opacity: 0,
                //     type: 'loader',
                //     state: 'brand',
                //     message: true
                // },

                icons: {
                    sort: {asc: 'la la-arrow-up', desc: 'la la-arrow-down'},
                    pagination: {
                        next: 'la la-angle-right',
                        prev: 'la la-angle-left',
                        first: 'la la-angle-double-left',
                        last: 'la la-angle-double-right',
                        more: 'la la-ellipsis-h'
                    },
                    rowDetail: {expand: 'fa fa-caret-down', collapse: 'fa fa-caret-right'}
                }
            },


            // columns definition
            columns: [
                {
                    field: 'id',
                    title: 'ID',
                    sortable: false,
                    width: 40
                }, {
                    field: 'original_filename',
                    title: 'Filename',
                    // width: 150
                }, {
                    field: 'description',
                    title: 'Description',
                    template: function(row) {
                        var originText = row.description;
                        var newText = "";
                        for(var i=0; i < originText.length; i++) {
                            if (originText.charCodeAt(i) == 10 && i != originText.length-1)
                                newText += '<br>';
                            else newText += originText[i];
                        }
                        return newText;
                    }
                }, {
                    field: 'file_size',
                    title: 'Size',
                    width: 90,
                    template: function(row) {
                        var unit = 'Bytes';
                        var file_size = row.file_size;
                        if(file_size >= 1024) {
                            file_size /= 1024;
                            unit = 'KB'
                        }
                        if(file_size >= 1024) {
                            file_size /= 1024;
                            unit = 'MB'
                        }
                        if(file_size >= 1024) {
                            file_size /= 1024;
                            unit = 'GB'
                        }
                        return file_size.toFixed(2) + ' ' + unit;
                    }
                }, {
                    field: 'file_type',
                    title: 'Type',
                    width: 70,
                }, {
                    field: 'created_formated',
                    title: 'Date',
                    width: 160,
                        template: function(row) {
                            return row.created_formated.split('.')[0].replace('T', ' ');
                        }
                    }, {
                        field: 'download_count',
                        title: downloadTdString,
                        type: 'number',
                        width: downloadTdWidth,
                        sortable: false,
                        template: function(row) {
                            var str =
                                '<a href="/download/'+row.saved_filename+'/'+row.original_filename+'" class="btn btn-primary m-btn m-btn--icon class_btnDownload">' +
                                    '<span>' +
                                            '<i class="la la-cloud-download"></i>' +
                                            '<span>Download</span>' +
                                    '</span>' +
                                '</a>';
                            if($("#id_isAdmin").val() == '1')
                                str += '<a href = "#" class="btn btn-danger m-btn m-btn--icon m-btn--icon-only m-btn--custom m-btn--pill m--margin-left-5" onclick = "onDelete('+row.id+')"><i class="la la-trash"></i></a>';
                            return str;
                        }
                    }
                ]
            });
        };

        return {
        // public functions
        init: function() {
            demo();
        },
    };
}();

function initFileUploader () {
    $('#drag-and-drop-zone').dmUploader({
        url: '/uploadFile',
        maxFileSize: 20000000,
        multiple: false,

        // extFilter: ['jpg', 'jpeg', 'png', 'gif'],
        extraData: {
            'description': $("#id_textDescription").val()
        },
        onDragEnter: function () {
            this.addClass('active');
        },
        onDragLeave: function () {
            this.removeClass('active');
        },
        onInit: function () {
            console.log('file uploader initialized :)', 'info');
        },
        onComplete: function () {
            console.log('All pending tranfers finished');
            $("#m_modal_upload").modal('hide');
            toastr.info('New file is uploaded', 'Success');
            file_datatable.reload();
        },
        onNewFile: function (id, file) {
            console.log('New file added #' + id);
            ui_multi_add_file(id, file);
        },
        onBeforeUpload: function (id) {
            console.log('Starting the upload of #' + id);
            ui_multi_update_file_status(id, 'uploading', 'Uploading...');
            ui_multi_update_file_progress(id, 0, '', true);
        },
        onUploadCanceled: function (id) {
            ui_multi_update_file_status(id, 'warning', 'Canceled by User');
            ui_multi_update_file_progress(id, 0, 'warning', false);
        },
        onUploadProgress: function (id, percent) {
            ui_multi_update_file_progress(id, percent);
        },
        onUploadSuccess: function (id, data) {
            console.log(data);
            $.post('/updateDescription', {
                'file_id' : data.id,
                'description' : $("#id_textDescription").val()
            }, function(data) {

            });
            //console.log('Server Response for file #' + id + ': ' + JSON.stringify(data));
            //console.log('Upload of file #' + id + ' COMPLETED', 'success');
            ui_multi_update_file_status(id, 'success', 'Upload Complete');
            ui_multi_update_file_progress(id, 100, 'success', false);
        },
        onUploadError: function (id, xhr, status, message) {
            ui_multi_update_file_status(id, 'danger', message);
            ui_multi_update_file_progress(id, 0, 'danger', false);
        },
        onFallbackMode: function () {
            console.log('Plugin cant be used here, running Fallback callback', 'danger');
        },
        onFileSizeError: function (file) {
            console.log('File \'' + file.name + '\' cannot be added: size excess limit', 'danger');
        },
        onFileTypeError: function (file) {
            console.log('File \'' + file.name + '\' cannot be added: must be an image (type error)', 'danger');
        },
        onFileExtError: function (file) {
            console.log('File \'' + file.name + '\' cannot be added: must be an image (extension error)', 'danger');
        }
    });
}

function onDelete(file_id) {
    $.post('/deleteFile', {
        file_id: file_id
    }, function(data) {
        if(data == true) {
            alert(data);
            toastr.info('File is deleted', 'Success');
            file_datatable.reload();

        }
    });
}