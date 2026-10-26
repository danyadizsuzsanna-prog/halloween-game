-- QR-kódok ellenőrzése. Futtasd a Supabase SQL Editorban.
-- Ez a lista mutatja, MIT kell tartalmaznia a kinyomtatott QR-nak állomásonként.
select s.room_name as helyszin,
       i.name      as osszetevo,
       s.kind      as tipus,
       s.qr_code   as ennek_kell_lennie_a_qr_ban
from stations s
join ingredients i on i.id = s.ingredient_id
order by s.room_name;
