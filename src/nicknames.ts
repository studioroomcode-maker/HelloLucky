/**
 * Sender names for lucky letters: one of 50 adjectives × 50 animals (id = adjective * 50 + animal).
 * Only the id travels; each phone spells it in its own language, so nothing typed ever reaches a stranger.
 * Gendered languages list "m|f" adjective forms (German "m|f|n" via endings) and tag each animal "name|g".
 */
const list = (s: string) => s.split(',');

export const ANIMAL_EMOJI = list(
  '🐞,🦔,🐿️,🐢,🐰,🦊,🐻,🐼,🐨,🐧,🦉,🐝,🦋,🐌,🐸,🐱,🐶,🐹,🦦,🐳,🐬,🦭,🐥,🦆,🦢,🐑,🦙,🐘,🦒,🦥,🐭,🦄,🐙,🐠,🦜,🐷,🐮,🐴,🦌,🦝,🦫,🐻‍❄️,🦩,🐡,🦀,🦘,🐯,🦁,🐒,🦚',
);

export const ANIMALS: Record<string, string[]> = {
  ko: list(
    '무당벌레,고슴도치,다람쥐,거북이,토끼,여우,곰,판다,코알라,펭귄,부엉이,꿀벌,나비,달팽이,개구리,고양이,강아지,햄스터,수달,고래,돌고래,물범,병아리,오리,백조,양,알파카,코끼리,기린,나무늘보,생쥐,유니콘,문어,열대어,앵무새,아기돼지,송아지,망아지,사슴,너구리,비버,북극곰,플라밍고,복어,꽃게,캥거루,호랑이,사자,원숭이,공작',
  ),
  en: list(
    'Ladybug,Hedgehog,Squirrel,Turtle,Bunny,Fox,Bear,Panda,Koala,Penguin,Owl,Bee,Butterfly,Snail,Frog,Cat,Puppy,Hamster,Otter,Whale,Dolphin,Seal,Chick,Duck,Swan,Lamb,Alpaca,Elephant,Giraffe,Sloth,Mouse,Unicorn,Octopus,Fish,Parrot,Piglet,Calf,Pony,Deer,Raccoon,Beaver,Polar Bear,Flamingo,Pufferfish,Crab,Kangaroo,Tiger,Lion,Monkey,Peacock',
  ),
  ja: list(
    'テントウムシ,ハリネズミ,リス,カメ,ウサギ,キツネ,クマ,パンダ,コアラ,ペンギン,フクロウ,ミツバチ,チョウチョ,カタツムリ,カエル,ネコ,子イヌ,ハムスター,カワウソ,クジラ,イルカ,アザラシ,ヒヨコ,アヒル,ハクチョウ,ヒツジ,アルパカ,ゾウ,キリン,ナマケモノ,ネズミ,ユニコーン,タコ,おさかな,インコ,こぶた,子ウシ,子ウマ,シカ,アライグマ,ビーバー,シロクマ,フラミンゴ,フグ,カニ,カンガルー,トラ,ライオン,サル,クジャク',
  ),
  'zh-Hans': list(
    '瓢虫,刺猬,松鼠,乌龟,兔子,狐狸,小熊,熊猫,考拉,企鹅,猫头鹰,蜜蜂,蝴蝶,蜗牛,青蛙,猫咪,小狗,仓鼠,水獭,鲸鱼,海豚,海豹,小鸡,鸭子,天鹅,绵羊,羊驼,大象,长颈鹿,树懒,小老鼠,独角兽,章鱼,小鱼,鹦鹉,小猪,小牛,小马,小鹿,浣熊,河狸,北极熊,火烈鸟,河豚,螃蟹,袋鼠,老虎,狮子,猴子,孔雀',
  ),
  'zh-Hant': list(
    '瓢蟲,刺蝟,松鼠,烏龜,兔子,狐狸,小熊,熊貓,無尾熊,企鵝,貓頭鷹,蜜蜂,蝴蝶,蝸牛,青蛙,貓咪,小狗,倉鼠,水獺,鯨魚,海豚,海豹,小雞,鴨子,天鵝,綿羊,羊駝,大象,長頸鹿,樹懶,小老鼠,獨角獸,章魚,小魚,鸚鵡,小豬,小牛,小馬,小鹿,浣熊,河狸,北極熊,紅鶴,河豚,螃蟹,袋鼠,老虎,獅子,猴子,孔雀',
  ),
  es: list(
    'mariquita|f,erizo|m,ardilla|f,tortuga|f,conejo|m,zorro|m,oso|m,panda|m,koala|m,pingüino|m,búho|m,abeja|f,mariposa|f,caracol|m,rana|f,gato|m,perrito|m,hámster|m,nutria|f,ballena|f,delfín|m,foca|f,pollito|m,pato|m,cisne|m,oveja|f,alpaca|f,elefante|m,jirafa|f,perezoso|m,ratoncito|m,unicornio|m,pulpo|m,pececito|m,loro|m,cerdito|m,ternero|m,potrillo|m,ciervo|m,mapache|m,castor|m,oso polar|m,flamenco|m,pez globo|m,cangrejo|m,canguro|m,tigre|m,león|m,mono|m,pavo real|m',
  ),
  fr: list(
    'coccinelle|f,hérisson|m,écureuil|m,tortue|f,lapin|m,renard|m,ours|m,panda|m,koala|m,pingouin|m,hibou|m,abeille|f,papillon|m,escargot|m,grenouille|f,chat|m,chiot|m,hamster|m,loutre|f,baleine|f,dauphin|m,phoque|m,poussin|m,canard|m,cygne|m,mouton|m,alpaga|m,éléphant|m,girafe|f,paresseux|m,souris|f,licorne|f,pieuvre|f,poisson|m,perroquet|m,porcelet|m,veau|m,poulain|m,faon|m,raton laveur|m,castor|m,ours polaire|m,flamant rose|m,poisson-globe|m,crabe|m,kangourou|m,tigre|m,lion|m,singe|m,paon|m',
  ),
  de: list(
    'Marienkäfer|m,Igel|m,Eichhörnchen|n,Schildkröte|f,Häschen|n,Fuchs|m,Bär|m,Panda|m,Koala|m,Pinguin|m,Eule|f,Biene|f,Schmetterling|m,Schnecke|f,Frosch|m,Kätzchen|n,Hündchen|n,Hamster|m,Otter|m,Wal|m,Delfin|m,Robbe|f,Küken|n,Ente|f,Schwan|m,Schäfchen|n,Alpaka|n,Elefant|m,Giraffe|f,Faultier|n,Maus|f,Einhorn|n,Krake|m,Fisch|m,Papagei|m,Ferkel|n,Kälbchen|n,Fohlen|n,Reh|n,Waschbär|m,Biber|m,Eisbär|m,Flamingo|m,Kugelfisch|m,Krabbe|f,Känguru|n,Tiger|m,Löwe|m,Äffchen|n,Pfau|m',
  ),
  pt: list(
    'joaninha|f,ouriço|m,esquilo|m,tartaruga|f,coelho|m,raposa|f,urso|m,panda|m,coala|m,pinguim|m,coruja|f,abelha|f,borboleta|f,caracol|m,sapo|m,gato|m,cachorrinho|m,hamster|m,lontra|f,baleia|f,golfinho|m,foca|f,pintinho|m,pato|m,cisne|m,ovelha|f,alpaca|f,elefante|m,girafa|f,bicho-preguiça|m,ratinho|m,unicórnio|m,polvo|m,peixinho|m,papagaio|m,porquinho|m,bezerro|m,potrinho|m,cervo|m,guaxinim|m,castor|m,urso-polar|m,flamingo|m,baiacu|m,caranguejo|m,canguru|m,tigre|m,leão|m,macaco|m,pavão|m',
  ),
  it: list(
    'coccinella|f,riccio|m,scoiattolo|m,tartaruga|f,coniglio|m,volpe|f,orso|m,panda|m,koala|m,pinguino|m,gufo|m,ape|f,farfalla|f,lumaca|f,rana|f,gatto|m,cagnolino|m,criceto|m,lontra|f,balena|f,delfino|m,foca|f,pulcino|m,papera|f,cigno|m,pecora|f,alpaca|m,elefante|m,giraffa|f,bradipo|m,topolino|m,unicorno|m,polpo|m,pesciolino|m,pappagallo|m,maialino|m,vitellino|m,puledro|m,cerbiatto|m,procione|m,castoro|m,orso polare|m,fenicottero|m,pesce palla|m,granchio|m,canguro|m,tigre|f,leone|m,scimmietta|f,pavone|m',
  ),
  ru: list(
    'божья коровка|f,ёжик|m,белочка|f,черепашка|f,зайчик|m,лисичка|f,мишка|m,панда|f,коала|f,пингвин|m,совёнок|m,пчёлка|f,бабочка|f,улитка|f,лягушка|f,котик|m,щенок|m,хомячок|m,выдра|f,кит|m,дельфин|m,тюлень|m,цыплёнок|m,уточка|f,лебедь|m,овечка|f,альпака|f,слонёнок|m,жираф|m,ленивец|m,мышонок|m,единорог|m,осьминог|m,рыбка|f,попугай|m,поросёнок|m,телёнок|m,жеребёнок|m,оленёнок|m,енот|m,бобрёнок|m,белый медвежонок|m,фламинго|m,рыба-фугу|f,крабик|m,кенгуру|m,тигрёнок|m,львёнок|m,обезьянка|f,павлин|m',
  ),
  id: list(
    'Kepik,Landak,Tupai,Kura-kura,Kelinci,Rubah,Beruang,Panda,Koala,Penguin,Burung Hantu,Lebah,Kupu-kupu,Siput,Katak,Kucing,Anak Anjing,Hamster,Berang-berang,Paus,Lumba-lumba,Anjing Laut,Anak Ayam,Bebek,Angsa,Domba,Alpaka,Gajah,Jerapah,Kungkang,Tikus,Unicorn,Gurita,Ikan,Burung Beo,Anak Babi,Anak Sapi,Anak Kuda,Rusa,Rakun,Beaver,Beruang Kutub,Flamingo,Ikan Buntal,Kepiting,Kanguru,Harimau,Singa,Monyet,Merak',
  ),
  vi: list(
    'Bọ rùa,Nhím,Sóc,Rùa,Thỏ,Cáo,Gấu,Gấu trúc,Gấu túi,Chim cánh cụt,Cú mèo,Ong,Bướm,Ốc sên,Ếch,Mèo,Cún con,Chuột hamster,Rái cá,Cá voi,Cá heo,Hải cẩu,Gà con,Vịt,Thiên nga,Cừu,Lạc đà alpaca,Voi,Hươu cao cổ,Con lười,Chuột nhắt,Kỳ lân,Bạch tuộc,Cá nhỏ,Vẹt,Heo con,Bê con,Ngựa con,Nai,Gấu mèo,Hải ly,Gấu Bắc Cực,Hồng hạc,Cá nóc,Cua,Chuột túi,Hổ,Sư tử,Khỉ,Công',
  ),
  th: list(
    'เต่าทอง,เม่น,กระรอก,เต่า,กระต่าย,จิ้งจอก,หมี,แพนด้า,โคอาลา,เพนกวิน,นกฮูก,ผึ้ง,ผีเสื้อ,หอยทาก,กบ,แมว,ลูกหมา,แฮมสเตอร์,นาก,วาฬ,โลมา,แมวน้ำ,ลูกเจี๊ยบ,เป็ด,หงส์,แกะ,อัลปากา,ช้าง,ยีราฟ,สลอธ,หนูน้อย,ยูนิคอร์น,ปลาหมึก,ปลา,นกแก้ว,ลูกหมู,ลูกวัว,ลูกม้า,กวาง,แรคคูน,บีเวอร์,หมีขั้วโลก,ฟลามิงโก,ปลาปักเป้า,ปู,จิงโจ้,เสือ,สิงโต,ลิง,นกยูง',
  ),
  ar: list(
    'دعسوقة|f,قنفذ|m,سنجاب|m,سلحفاة|f,أرنب|m,ثعلب|m,دب|m,باندا|m,كوالا|m,بطريق|m,بومة|f,نحلة|f,فراشة|f,حلزون|m,ضفدع|m,قطة|f,جرو|m,هامستر|m,قضاعة|f,حوت|m,دلفين|m,فقمة|f,كتكوت|m,بطة|f,بجعة|f,خروف|m,ألبكة|f,فيل|m,زرافة|f,كسلان|m,فأر|m,يونيكورن|m,أخطبوط|m,سمكة|f,ببغاء|m,خنزير وردي|m,عجل|m,مهر|m,غزال|m,راكون|m,قندس|m,دب قطبي|m,فلامنغو|m,سمكة نفاخة|f,سلطعون|m,كنغر|m,نمر|m,أسد|m,قرد|m,طاووس|m',
  ),
  sw: list(
    'Kidudu Madoa,Kalunguyeye,Kindi,Kobe,Sungura,Mbweha,Dubu,Panda,Koala,Pengwini,Bundi,Nyuki,Kipepeo,Konokono,Chura,Paka,Kijibwa,Hamsta,Fisimaji,Nyangumi,Pomboo,Sili,Kifaranga,Bata,Swani,Mwanakondoo,Alpaka,Tembo,Twiga,Slothi,Panya,Farasi Pembe,Pweza,Samaki,Kasuku,Kinguruwe,Ndama,Kifarasi,Kulungu,Rakuni,Biva,Dubu Barafu,Heroe,Bunju,Kaa,Kangaruu,Simbamarara,Simba,Tumbili,Tausi',
  ),
};

export const ADJECTIVES: Record<string, string[]> = {
  ko: list(
    '용감한,수줍은,졸린,반짝이는,느긋한,씩씩한,다정한,행복한,꿈꾸는,춤추는,노래하는,웃는,신난,포근한,말랑한,동그란,부지런한,호기심 많은,산책하는,낮잠 자는,별을 보는,휘파람 부는,상냥한,명랑한,엉뚱한,재빠른,해맑은,든든한,조용한,행운의,여행하는,지혜로운,새침한,폭신한,깜찍한,수다스러운,친절한,우아한,장난스러운,콧노래 부르는,소풍 가는,책 읽는,무지갯빛,햇살 같은,하늘을 나는,봄날의,인사하는,꼬마,응원하는,행운을 나누는',
  ),
  en: list(
    'Brave,Shy,Sleepy,Sparkly,Easygoing,Plucky,Kind,Happy,Dreamy,Dancing,Singing,Smiling,Excited,Cozy,Squishy,Round,Busy,Curious,Strolling,Napping,Stargazing,Whistling,Gentle,Cheerful,Quirky,Speedy,Bright-Eyed,Trusty,Quiet,Lucky,Traveling,Wise,Prim,Fluffy,Cute,Chatty,Friendly,Elegant,Playful,Humming,Picnicking,Bookish,Rainbow,Sunshine,Flying,Springtime,Waving,Little,Cheering,Luck-Sharing',
  ),
  ja: list(
    '勇敢な,はずかしがりの,ねむたい,キラキラの,のんびり,元気な,やさしい,しあわせな,夢みる,おどる,歌う,にこにこ,わくわく,ぽかぽか,ぷにぷに,まんまる,はたらき者の,好奇心いっぱいの,おさんぽ中の,おひるね中の,星を見る,口笛をふく,おだやかな,ほがらかな,へんてこな,すばしっこい,無邪気な,たのもしい,しずかな,ラッキーな,旅する,かしこい,すました,ふわふわ,キュートな,おしゃべりな,親切な,エレガントな,いたずら好きの,鼻歌まじりの,ピクニック中の,本を読む,にじいろの,おひさまみたいな,空とぶ,春の,手をふる,ちびっこ,応援する,幸運をわける',
  ),
  'zh-Hans': list(
    '勇敢的,害羞的,困困的,闪闪发光的,悠闲的,元气满满的,温柔的,幸福的,爱做梦的,跳舞的,唱歌的,爱笑的,兴奋的,暖乎乎的,软乎乎的,圆滚滚的,勤劳的,好奇的,散步的,打盹的,看星星的,吹口哨的,和善的,开朗的,古灵精怪的,敏捷的,天真的,可靠的,安静的,幸运的,爱旅行的,聪明的,傲娇的,毛茸茸的,可爱的,话痨的,友好的,优雅的,调皮的,哼着歌的,去野餐的,爱读书的,彩虹色的,阳光般的,会飞的,春天的,挥手的,小小的,加油的,分享幸运的',
  ),
  'zh-Hant': list(
    '勇敢的,害羞的,睏睏的,閃閃發光的,悠閒的,元氣滿滿的,溫柔的,幸福的,愛做夢的,跳舞的,唱歌的,愛笑的,興奮的,暖呼呼的,軟呼呼的,圓滾滾的,勤勞的,好奇的,散步的,打盹的,看星星的,吹口哨的,和善的,開朗的,古靈精怪的,敏捷的,天真的,可靠的,安靜的,幸運的,愛旅行的,聰明的,傲嬌的,毛茸茸的,可愛的,話癆的,友善的,優雅的,調皮的,哼著歌的,去野餐的,愛讀書的,彩虹色的,陽光般的,會飛的,春天的,揮手的,小小的,加油的,分享幸運的',
  ),
  es: list(
    'valiente,tímido|tímida,dormilón|dormilona,brillante,tranquilo|tranquila,animoso|animosa,cariñoso|cariñosa,feliz,soñador|soñadora,bailarín|bailarina,cantarín|cantarina,sonriente,emocionado|emocionada,acogedor|acogedora,blandito|blandita,redondito|redondita,trabajador|trabajadora,curioso|curiosa,paseante,que duerme la siesta,que mira las estrellas,silbador|silbadora,amable,alegre,ocurrente,veloz,radiante,fiel,silencioso|silenciosa,afortunado|afortunada,viajero|viajera,sabio|sabia,presumido|presumida,esponjoso|esponjosa,adorable,parlanchín|parlanchina,simpático|simpática,elegante,juguetón|juguetona,que tararea,de pícnic,lector|lectora,arcoíris,luminoso|luminosa,volador|voladora,primaveral,que saluda,pequeñito|pequeñita,animador|animadora,que reparte suerte',
  ),
  fr: list(
    'courageux|courageuse,timide,endormi|endormie,scintillant|scintillante,tranquille,vaillant|vaillante,affectueux|affectueuse,heureux|heureuse,rêveur|rêveuse,danseur|danseuse,chanteur|chanteuse,souriant|souriante,ravi|ravie,douillet|douillette,tout mou|toute molle,tout rond|toute ronde,travailleur|travailleuse,curieux|curieuse,promeneur|promeneuse,qui fait la sieste,qui regarde les étoiles,siffleur|siffleuse,gentil|gentille,joyeux|joyeuse,farfelu|farfelue,rapide,rayonnant|rayonnante,fidèle,discret|discrète,chanceux|chanceuse,voyageur|voyageuse,sage,coquet|coquette,duveteux|duveteuse,mignon|mignonne,bavard|bavarde,aimable,élégant|élégante,espiègle,qui fredonne,en pique-nique,liseur|liseuse,arc-en-ciel,lumineux|lumineuse,volant|volante,printanier|printanière,qui fait coucou,miniature,qui encourage,qui partage la chance',
  ),
  // German: stems; the ending follows the animal (mutiger Igel, mutige Biene, mutiges Reh).
  de: list(
    'mutig,schüchtern,schläfrig,funkelnd,gemütlich,tapfer,lieb,froh,verträumt,tanzend,singend,lächelnd,aufgeregt,kuschelig,knautschig,kugelrund,fleißig,neugierig,bummelnd,dösend,sternguckend,pfeifend,sanft,fröhlich,schrullig,flink,strahlend,treu,still,glücklich,reisend,weise,vornehm,flauschig,niedlich,gesprächig,freundlich,elegant,verspielt,summend,picknickend,belesen,regenbogenbunt,sonnig,fliegend,frühlingshaft,winkend,klein,jubelnd,glücksbringend',
  ),
  pt: list(
    'corajoso|corajosa,tímido|tímida,sonolento|sonolenta,brilhante,tranquilo|tranquila,animado|animada,carinhoso|carinhosa,feliz,sonhador|sonhadora,dançarino|dançarina,cantor|cantora,sorridente,empolgado|empolgada,aconchegante,molinho|molinha,redondinho|redondinha,trabalhador|trabalhadora,curioso|curiosa,passeador|passeadora,que tira soneca,que olha as estrelas,assobiador|assobiadora,gentil,alegre,maluquinho|maluquinha,veloz,radiante,fiel,quietinho|quietinha,sortudo|sortuda,viajante,sábio|sábia,vaidoso|vaidosa,fofo|fofa,lindinho|lindinha,tagarela,simpático|simpática,elegante,brincalhão|brincalhona,que cantarola,de piquenique,leitor|leitora,arco-íris,luminoso|luminosa,voador|voadora,primaveril,que acena,pequenino|pequenina,torcedor|torcedora,que espalha sorte',
  ),
  it: list(
    'coraggioso|coraggiosa,timido|timida,assonnato|assonnata,scintillante,tranquillo|tranquilla,grintoso|grintosa,affettuoso|affettuosa,felice,sognatore|sognatrice,ballerino|ballerina,canterino|canterina,sorridente,entusiasta,coccoloso|coccolosa,morbido|morbida,rotondetto|rotondetta,laborioso|laboriosa,curioso|curiosa,passeggiatore|passeggiatrice,che fa il pisolino,che guarda le stelle,fischiettante,gentile,allegro|allegra,stravagante,svelto|svelta,radioso|radiosa,fidato|fidata,silenzioso|silenziosa,fortunato|fortunata,viaggiatore|viaggiatrice,saggio|saggia,civettuolo|civettuola,soffice,carino|carina,chiacchierone|chiacchierona,simpatico|simpatica,elegante,giocherellone|giocherellona,che canticchia,in gita,lettore|lettrice,arcobaleno,solare,volante,primaverile,che saluta,piccolino|piccolina,tifoso|tifosa,portafortuna',
  ),
  ru: list(
    'смелый|смелая,застенчивый|застенчивая,сонный|сонная,сверкающий|сверкающая,неторопливый|неторопливая,бойкий|бойкая,ласковый|ласковая,счастливый|счастливая,мечтательный|мечтательная,танцующий|танцующая,поющий|поющая,улыбчивый|улыбчивая,восторженный|восторженная,уютный|уютная,мягонький|мягонькая,кругленький|кругленькая,трудолюбивый|трудолюбивая,любопытный|любопытная,гуляющий|гуляющая,дремлющий|дремлющая,звёздный|звёздная,свистящий|свистящая,добрый|добрая,весёлый|весёлая,забавный|забавная,шустрый|шустрая,лучезарный|лучезарная,надёжный|надёжная,тихий|тихая,везучий|везучая,путешествующий|путешествующая,мудрый|мудрая,важный|важная,пушистый|пушистая,милый|милая,болтливый|болтливая,дружелюбный|дружелюбная,изящный|изящная,озорной|озорная,напевающий|напевающая,походный|походная,читающий|читающая,радужный|радужная,солнечный|солнечная,летающий|летающая,весенний|весенняя,машущий|машущая,маленький|маленькая,подбадривающий|подбадривающая,приносящий удачу|приносящая удачу',
  ),
  id: list(
    'Pemberani,Pemalu,Mengantuk,Berkilau,Santai,Bersemangat,Penyayang,Bahagia,Pemimpi,Penari,Penyanyi,Tersenyum,Riang,Hangat,Kenyal,Bulat,Rajin,Penasaran,Jalan-jalan,Tidur Siang,Pengamat Bintang,Bersiul,Ramah,Ceria,Unik,Gesit,Polos,Setia,Pendiam,Beruntung,Pengelana,Bijak,Jaim,Lembut,Imut,Cerewet,Baik Hati,Anggun,Jahil,Bersenandung,Piknik,Kutu Buku,Pelangi,Cerah,Terbang,Musim Semi,Melambai,Kecil,Penyemangat,Pembawa Hoki',
  ),
  vi: list(
    'dũng cảm,nhút nhát,buồn ngủ,lấp lánh,thong thả,hăng hái,dịu dàng,hạnh phúc,mơ mộng,nhảy múa,ca hát,tươi cười,phấn khích,ấm áp,mềm mại,tròn trịa,chăm chỉ,tò mò,đi dạo,ngủ trưa,ngắm sao,huýt sáo,hiền lành,vui vẻ,ngộ nghĩnh,nhanh nhẹn,hồn nhiên,đáng tin,trầm lặng,may mắn,đi du lịch,thông thái,điệu đà,bông xù,dễ thương,ríu rít,thân thiện,thanh lịch,tinh nghịch,ngân nga,đi dã ngoại,mọt sách,sắc cầu vồng,tỏa nắng,biết bay,mùa xuân,vẫy tay,tí hon,cổ vũ,trao may mắn',
  ),
  th: list(
    'ผู้กล้าหาญ,ขี้อาย,ง่วงนอน,วิบวับ,สบายๆ,ใจสู้,อบอุ่น,มีความสุข,ช่างฝัน,นักเต้น,นักร้อง,ยิ้มแย้ม,ตื่นเต้น,นุ่มอุ่น,นุ่มนิ่ม,กลมดิ๊ก,ขยัน,ช่างสงสัย,เดินเล่น,งีบหลับ,ดูดาว,ผิวปาก,ใจดี,ร่าเริง,ติงต๊อง,ว่องไว,ใสซื่อ,ไว้ใจได้,เงียบขรึม,โชคดี,นักเดินทาง,ฉลาด,ขี้เก๊ก,ฟูฟ่อง,น่ารัก,ช่างพูด,เป็นมิตร,สง่างาม,ซุกซน,ฮัมเพลง,ไปปิกนิก,หนอนหนังสือ,สีรุ้ง,สดใส,บินได้,ฤดูใบไม้ผลิ,โบกมือ,ตัวน้อย,นักเชียร์,แบ่งปันโชค',
  ),
  ar: list(
    'شجاع|شجاعة,خجول|خجولة,نعسان|نعسانة,لامع|لامعة,مرتاح البال|مرتاحة البال,مقدام|مقدامة,طيب|طيبة,سعيد|سعيدة,حالم|حالمة,يرقص|ترقص,يغني|تغني,مبتسم|مبتسمة,متحمس|متحمسة,دافئ|دافئة,طري|طرية,مدوّر|مدوّرة,مجتهد|مجتهدة,فضولي|فضولية,يتنزه|تتنزه,يغفو|تغفو,يتأمل النجوم|تتأمل النجوم,يصفّر|تصفّر,رقيق|رقيقة,مرح|مرحة,طريف|طريفة,سريع|سريعة,بشوش|بشوشة,وفي|وفية,هادئ|هادئة,محظوظ|محظوظة,مسافر|مسافرة,حكيم|حكيمة,متأنق|متأنقة,منفوش|منفوشة,ظريف|ظريفة,ثرثار|ثرثارة,ودود|ودودة,أنيق|أنيقة,مشاكس|مشاكسة,يدندن|تدندن,في نزهة,قارئ|قارئة,قزحي|قزحية,مشرق|مشرقة,يطير|تطير,ربيعي|ربيعية,يلوّح|تلوّح,صغير|صغيرة,مشجّع|مشجّعة,يوزّع الحظ|توزّع الحظ',
  ),
  sw: list(
    'Jasiri,Mwenye Haya,Mwenye Usingizi,Anayemetameta,Asiye na Haraka,Hodari,Mwenye Huruma,Mwenye Furaha,Anayeota Ndoto,Anayecheza Ngoma,Anayeimba,Anayetabasamu,Mwenye Hamasa,Mwenye Joto,Laini,Mviringo,Mchapakazi,Mdadisi,Anayetembea,Anayelala Mchana,Anayetazama Nyota,Anayepiga Mluzi,Mwenye Upole,Mchangamfu,Kituko,Mwenye Kasi,Mwenye Macho Angavu,Mwaminifu,Kimya,Mwenye Bahati,Msafiri,Mwenye Hekima,Nadhifu,Mwenye Manyoya,Wa Kupendeza,Mzungumzaji,Rafiki wa Wote,Maridadi,Mtundu,Anayevuma Wimbo,Anayeenda Pikniki,Msomaji,Wa Upinde wa Mvua,Wa Mwangaza,Anayeruka,Wa Kuchipua,Anayepunga Mkono,Mdogo,Anayeshangilia,Anayegawa Bahati',
  ),
};

export const NICKNAME_COUNT = 50 * 50;

const NOUN_FIRST = new Set(['es', 'fr', 'it', 'pt', 'id', 'vi', 'th', 'ar', 'sw']);
const cap = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

/** "🦔 용감한 고슴도치", "🐝 Abeille courageuse", "🐿️ Mutiges Eichhörnchen"; '' for an id outside the list. */
export function nickname(id: number | null | undefined, lang: string): string {
  if (!Number.isInteger(id) || id! < 0 || id! >= NICKNAME_COUNT) return '';
  const a = Math.floor(id! / 50);
  const n = id! % 50;
  const code = lang in ANIMALS ? lang : 'en';
  const [noun, g = 'm'] = ANIMALS[code][n].split('|');
  const forms = ADJECTIVES[code][a].split('|');
  const adj =
    code === 'de'
      ? forms[0] + (forms[0].endsWith('e') ? { m: 'r', f: '', n: 's' } : { m: 'er', f: 'e', n: 'es' })[g as 'm' | 'f' | 'n']
      : (forms[g === 'f' ? 1 : 0] ?? forms[0]);
  const joiner = /^(ja|zh|th)/.test(code) ? '' : ' ';
  const name = NOUN_FIRST.has(code) ? noun + joiner + adj : adj + joiner + noun;
  return `${ANIMAL_EMOJI[n]} ${cap(name)}`;
}

export const randomNickname = () => Math.floor(Math.random() * NICKNAME_COUNT);
