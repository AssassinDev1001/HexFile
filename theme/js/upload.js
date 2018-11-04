$(document).ready(function() {

    $("#id_imgAvatar").click(function() {
        $('#id_current_url').val(window.location.href);
        $("#id_fileAvatar").click();
    });

    $("#id_fileAvatar").change(function() {

        if (this.files && this.files[0]) {

            var reader = new FileReader();
            reader.onload = function (e) {
                $('#id_imgAvatar').attr('src', e.target.result);
                $('#id_imgAvatar').css('width', 42);
                $('#id_imgAvatar').css('height', 42);
                $("#id_formUploadAvatar").submit();
            };
            reader.readAsDataURL(this.files[0]);
        }
    });
});