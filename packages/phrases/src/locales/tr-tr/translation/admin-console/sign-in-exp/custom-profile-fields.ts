const custom_profile_fields = {
  table: {
    add_button: 'Profil alanı ekle',
    title: {
      field_label: 'Alan etiketi',
      type: 'Tür',
      user_data_key: 'Kullanıcı profilindeki anahtar',
    },
    placeholder: {
      title: 'Kullanıcı profilini topla',
      description:
        'Kayıt sırasında daha fazla kullanıcı profili bilgisi toplamak için alanları özelleştirin.',
    },
  },
  type: {
    Text: 'Metin',
    Number: 'Sayı',
    Date: 'Tarih',
    Checkbox: 'Onay kutusu (Boolean)',
    Select: 'Açılır menü (Tek seçim)',
    Url: 'URL',
    Regex: 'Düzenli ifade',
    Address: 'Adres (Bileşim)',
    Fullname: 'Tam ad (Bileşim)',
  },
  modal: {
    title: 'Profil alanı ekle',
    subtitle:
      'Kayıt sırasında daha fazla kullanıcı profili bilgisi toplamak için alanları özelleştirin.',
    built_in_properties: 'Yerleşik kullanıcı profili özellikleri',
    custom_properties: 'Özel özellikler',
    custom_data_field_name: 'Özel veri alanı adı',
    custom_data_field_input_placeholder: 'Özel veri alanı adını girin, örn. `benimFavoriAlanAdim`',
    custom_field: {
      title: 'Özel veri alanı',
      description:
        'Uygulamanızın benzersiz gereksinimlerini karşılamak için tanımlayabileceğiniz herhangi bir ek kullanıcı özelliği.',
    },
    type_required: 'Lütfen bir özellik türü seçin',
    create_button: 'Profil alanı oluştur',
  },
  details: {
    page_title: 'Profil alanı detayları',
    back_to_sie: 'Oturum açma deneyimine geri dön',
    enter_field_name: 'Profil alanı adını girin',
    delete_description:
      'Bu işlem geri alınamaz. Bu profil alanını silmek istediğinizden emin misiniz?',
    field_deleted: '{{name}} profil alanı başarıyla silindi.',
    key: 'Kullanıcı veri anahtarı',
    field_name: 'Alan adı',
    field_type: 'Alan türü',
    settings: 'Ayarlar',
    settings_description:
      'Kayıt sırasında daha fazla kullanıcı profili bilgisi toplamak için alanları özelleştirin.',
    address_format: 'Adres formatı',
    single_line_address: 'Tek satır adres',
    multi_line_address: 'Çok satırlı adres (Örn., Sokak, Şehir, Eyalet, Posta Kodu, Ülke)',
    composition_parts: 'Bileşim parçaları',
    composition_parts_tip: 'Karmaşık alanı oluşturmak için parçaları seçin.',
    label: 'Görüntüleme etiketi',
    label_placeholder: 'Etiket',
    label_tip:
      'Yerelleştirme mi gerekiyor? <a>Oturum açma deneyimi > İçerik</a> bölümünden diller ekleyin',
    placeholder: 'Yer tutucu görüntüle',
    placeholder_placeholder: 'Yer tutucu',
    description: 'Görüntüleme açıklaması',
    description_placeholder: 'Açıklama',
    options: 'Seçenekler',
    options_tip:
      'Her seçeneği yeni bir satıra girin. Anahtar ve değeri ayırmak için noktalı virgül kullanın, örn. `anahtar:değer`',
    options_placeholder: 'değer1:etiket1\ndeğer2:etiket2\ndeğer3:etiket3',
    regex: 'Düzenli ifade',
    regex_tip: 'Girdiyi doğrulamak için bir düzenli ifade tanımlayın.',
    regex_placeholder: '^[a-zA-Z0-9]+$',
    date_format: 'Tarih formatı',
    date_format_us: 'Amerika Birleşik Devletleri (AA/gg/yyyy)',
    date_format_uk: 'İngiltere ve Avrupa (gg/AA/yyyy)',
    date_format_iso: 'Uluslararası standart (yyyy-AA-gg)',
    custom_date_format: 'Özel tarih formatı',
    custom_date_format_placeholder: 'Özel tarih formatını girin. Örn. "AA-gg-yyyy"',
    custom_date_format_tip:
      'Geçerli biçimlendirme belirteçleri için <a>date-fns</a> dokümanlarına bakın.',
    input_length: 'Girdi uzunluğu',
    value_range: 'Değer aralığı',
    min: 'Minimum',
    max: 'Maksimum',
    required: 'Zorunlu',
    required_description:
      'Etkinleştirildiğinde, bu alan kullanıcılar tarafından doldurulmalıdır. Devre dışı bırakıldığında, bu alan isteğe bağlıdır.',
  },
};

export default Object.freeze(custom_profile_fields);
