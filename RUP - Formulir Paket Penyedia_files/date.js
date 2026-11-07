$(document).ready(function(){
	$("#dateAwalPengadaan").datepicker({
        dateFormat: 'dd/mm/yy',
        minDate: 0,
        onSelect: function(dateText, inst){
            $("#dateAkhirPengadaan").datepicker('option', 'minDate', $("#dateAwalPengadaan").datepicker("getDate"));
        }
 	});
    $("#dateAkhirPengadaan").datepicker({
        dateFormat: 'dd/mm/yy',
        onSelect: function(dateText, inst){
            $("#dateAwalPekerjaan").datepicker('option', 'minDate', $("#dateAkhirPengadaan").datepicker("getDate"));
        }
    });

	$("#dateAwalPekerjaan").datepicker({
		dateFormat: 'dd/mm/yy',
		onSelect: function(dateText, inst){
            $("#dateAkhirPekerjaan").datepicker('option', 'minDate', $("#dateAwalPekerjaan").datepicker("getDate"));
        }
	 });

    $("#dateAkhirPekerjaan").datepicker({dateFormat: 'dd/mm/yy',  minDate: 0});

	$("#dateApapun").datepicker({
		dateFormat: "dd/mm/yy"
	});

	//$("#tanggal_akhir").datepicker();

});
