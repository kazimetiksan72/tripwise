# FişGaranti web paneli ve API

React yönetim paneli ve Vercel Node.js API fonksiyonlarıdır. Mobil uygulama native Apple tokenı ile giriş yapar; web paneli MongoDB'de saklanan yönetici e-posta ve parola kaydıyla giriş yapar.

## Yerel geliştirme

1. Node.js 22 ve MongoDB Atlas bağlantısını ayarlayın.
2. `.env.example` dosyasını `.env.local` olarak kopyalayın. `MONGODB_URI`, `SESSION_SECRET`, `APPLE_IOS_BUNDLE_ID` ve `OPENAI_API_KEY` değerlerini girin.
3. Web panelini `npm run dev` ile açın. Vercel API fonksiyonlarını yerelde kullanmak için `vercel dev` çalıştırın.
4. İlk yönetici hesabını eklemek için `.env.local` içine `ADMIN_EMAIL`, en az 12 karakterli `ADMIN_PASSWORD` ve isteğe bağlı `ADMIN_NAME` değerlerini yazın. Aynı dosyada production ile aynı `MONGODB_URI` olmalı. Ardından `npm run create-admin` çalıştırın. Parola bcrypt ile hashlenerek MongoDB `admins` koleksiyonuna kaydedilir.

## API uçları

- `POST /api/auth/apple/nonce` — mobil Apple girişine özel, 5 dakikada sona eren tek kullanımlık nonce üretir.
- `POST /api/auth/apple` — Apple identity tokenını imza, issuer, audience ve nonce kontrollerinden geçirir; MongoDB'de mobil kullanıcı kaydını oluşturur/günceller ve mobil bearer token verir.
- `GET /api/auth/me` — web yönetici oturumunu veya mobil bearer oturumunu döndürür.
- `POST /api/auth/logout` — web yönetici çerezini temizler.
- `POST /api/receipts` — mobil fotoğrafı OpenAI ile analiz eder ve çıkarılan alanları kullanıcının MongoDB fiş kaydına yazar.
- `GET /api/receipts` — oturum açmış mobil kullanıcının kendi fişlerini listeler.
- `DELETE /api/receipts/:id` — kullanıcının kendi fiş kaydını siler.
- `POST /api/admin/auth/login` — normal e-posta/şifre yönetici girişi yapar ve HttpOnly oturum çerezi verir.
- `GET /api/admin/auth/me` — mevcut yönetici profilini döndürür.
- `GET /api/admin/users?page=1` — yöneticiye mobil kullanıcı listesini sunar.
- `GET /api/admin/receipts?page=1` — yöneticiye tüm mobil fiş kayıtlarını sayfalı sunar.
- `POST /api/analyze-receipt` — yönetim panelinde seçilen görselleri analiz eder ve analiz sonucunu da MongoDB'ye kaydeder.

## Vercel değişkenleri

| Değişken | Kullanım |
| --- | --- |
| `MONGODB_URI` | MongoDB bağlantı URI'si (gizli). |
| `MONGODB_DB` | İsteğe bağlı veritabanı adı; varsayılan `fisgaranti`. |
| `SESSION_SECRET` | Oturum imzalama için en az 32 karakterli rastgele değer. |
| `APPLE_IOS_BUNDLE_ID` | Apple token audience değeri; iOS Bundle ID ile aynı olmalı (`com.pikselmutfak.tripwise`). |
| `OPENAI_API_KEY` | Sunucudaki OpenAI anahtarı; mobil/web istemciye eklenmez. |
| `OPENAI_MODEL` | İsteğe bağlı analiz modeli; varsayılan `gpt-6-luna`. |

Vercel projesi `vercel.json` üzerinden Vite build ve Node.js 22 API fonksiyonları kullanır. Yönetici parolası Vercel ortam değişkeninde tutulmaz; `npm run create-admin` ile hashlenerek MongoDB'ye yazılır. İlk deployment'tan sonra yönetim paneline giriş yapabilmek için en az bir yönetici hesabını bu komutla oluşturun. Yönetici kaydı eklemek veya parolayı değiştirmek için aynı komutu yeniden çalıştırın.

Gelen fiş görselleri kalıcı olarak saklanmaz. Görseller OpenAI Responses API'ye `store: false` ile analiz amacıyla gönderilir; çıkarılan yapılandırılmış belge alanları kullanıcı kimliğiyle MongoDB'de tutulur.
