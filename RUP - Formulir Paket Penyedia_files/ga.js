$(document).ready(function($){
    loginSubmitted()
    loginSuccess()
    loginClicked()
});

function loginSubmitted() {
    $('#submitPrimary').on('click', function () {
        addGaEvent("login_submitted", {'username': $("[name='txtUsername']").val()})
    });
}

function loginSuccess() {
    var textLoginSuccess = $('.alert.alert-success').text();

    if (textLoginSuccess.trim().match(/Selamat Datang/)) {
        addGaEvent("login_success", BASIC_DATA)
    }
}

function loginClicked() {
    $('#login-clicked').on('click', function() {
        addGaEvent("login_clicked")
    });
}

function addGaEvent(eventName, userPropertiesParam) {
    var params = {
        'page_location': window.location.href,
        'page_title': document.title,
        'page_referrer': document.referrer,
        'platform': platform.name,
    }

    if (userPropertiesParam !== null && typeof userPropertiesParam !== 'undefined') {

        var userProperties = {};
        if (userPropertiesParam.username != null && typeof userPropertiesParam.username !== 'undefined') {
            userProperties['username'] = userPropertiesParam.username
        }
        if (userPropertiesParam.email != null && typeof userPropertiesParam.email !== 'undefined') {
            userProperties['email'] = userPropertiesParam.email
        }
        if (userPropertiesParam.role != null && typeof userPropertiesParam.role !== 'undefined') {
            userProperties['role'] = userPropertiesParam.role
        }
        if (userPropertiesParam.namaSatker != null && typeof userPropertiesParam.namaSatker !== 'undefined') {
            userProperties['satker_name'] = userPropertiesParam.namaSatker
        }
        if (userPropertiesParam.idSatker != null && typeof userPropertiesParam.idSatker !== 'undefined') {
            userProperties['satker_code'] = userPropertiesParam.idSatker
        }
        if (userPropertiesParam.namaKldi != null && typeof userPropertiesParam.namaKldi !== 'undefined') {
            userProperties['institute_name'] = userPropertiesParam.namaKldi
        }
        if (userPropertiesParam.idKldi != null && typeof userPropertiesParam.idKldi !== 'undefined') {
            userProperties['institute_code'] = userPropertiesParam.idKldi
        }
        if (userPropertiesParam.jenisKLDIUser != null && typeof userPropertiesParam.jenisKLDIUser !== 'undefined') {
            userProperties['institute_type'] = userPropertiesParam.jenisKLDIUser
        }

        params['user_properties'] = userProperties
    }

   gtag('event', eventName, params)
}