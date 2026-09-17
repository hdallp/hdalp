/**
 * Effect Lab - 12 Strict Emoji Categories, Parsing & Exclusion Sync
 */

const COLOR_NAMES_MAP = {
  'vermelho': 'red', 'vermelha': 'red', 'vermelhos': 'red', 'vermelhas': 'red', 'red': 'red',
  'laranja': 'orange', 'laranjas': 'orange', 'orange': 'orange',
  'amarelo': 'yellow', 'amarela': 'yellow', 'amarelos': 'yellow', 'amarelas': 'yellow', 'yellow': 'yellow',
  'verde': 'green', 'verdes': 'green', 'green': 'green',
  'azul': 'blue', 'azuis': 'blue', 'blue': 'blue',
  'roxo': 'purple', 'roxa': 'purple', 'roxos': 'purple', 'roxas': 'purple', 'violeta': 'purple', 'purple': 'purple',
  'rosa': 'pink', 'rosas': 'pink', 'pink': 'pink',
  'marrom': 'brown', 'marroms': 'brown', 'marrons': 'brown', 'castanho': 'brown', 'brown': 'brown',
  'preto': 'black', 'preta': 'black', 'pretos': 'black', 'pretas': 'black', 'negro': 'black', 'black': 'black',
  'branco': 'white', 'branca': 'white', 'brancos': 'white', 'brancas': 'white', 'white': 'white',
  'cinza': 'gray', 'cinzas': 'gray', 'grey': 'gray', 'gray': 'gray'
};

const COLOR_LABEL_MAP = {
  'red': 'Vermelho',
  'orange': 'Laranja',
  'yellow': 'Amarelo',
  'green': 'Verde',
  'blue': 'Azul',
  'purple': 'Roxo',
  'pink': 'Rosa',
  'brown': 'Marrom',
  'black': 'Preto',
  'white': 'Branco',
  'gray': 'Cinza'
};

function getEmojiColorCategory(e) {
  if (!e || !e.avgColor) return 'other';
  const [h, s, l] = e.avgColor.hsl || [0, 0, 0];
  if (l <= 27 && s <= 25) return 'black';
  if (l >= 75 && s <= 25) return 'white';
  if (s <= 14) return 'gray';
  if (h >= 10 && h < 45 && l <= 45 && s <= 65) return 'brown';
  if (h >= 345 || h < 15) return 'red';
  if (h >= 15 && h < 45) return 'orange';
  if (h >= 45 && h < 70) return 'yellow';
  if (h >= 70 && h < 165) return 'green';
  if (h >= 165 && h < 260) return 'blue';
  if (h >= 260 && h < 315) return 'purple';
  if (h >= 315 && h < 345) return 'pink';
  return 'other';
}

function normalizeEmojiStr(str) {
  if (!str) return '';
  return str.replace(/[\uFE0E\uFE0F]/g, '').trim().toLowerCase();
}

// Categorias do Emojicloud com correspondência estrita e precisa
const CATEGORY_DEFINITIONS = [
  {
    id: 'emojis',
    label: 'Rostos & Emojis',
    test: e => {
      const n = (e.name || '').toLowerCase();
      const faceExact = ['grinning', 'smiley', 'smile', 'grin', 'laughing', 'sweat_smile', 'joy', 'rofl', 'relaxed', 'slightly_smiling_face', 'upside_down_face', 'wink', 'relieved', 'heart_eyes', 'smiling_face_with_3_hearts', 'kissing_heart', 'kissing', 'kissing_smiling_eyes', 'kissing_closed_eyes', 'yum', 'stuck_out_tongue', 'stuck_out_tongue_winking_eye', 'stuck_out_tongue_closed_eyes', 'money_mouth_face', 'hugging_face', 'hugs', 'face_with_hand_over_mouth', 'shushing_face', 'thinking', 'thinking_face', 'zipper_mouth_face', 'raised_eyebrow', 'neutral_face', 'expressionless', 'no_mouth', 'smirk', 'unamused', 'rolling_eyes', 'grimacing', 'lying_face', 'pensive', 'sleepy', 'drooling_face', 'sleeping', 'mask', 'face_with_thermometer', 'face_with_head_bandage', 'nauseated_face', 'face_vomiting', 'sneezing_face', 'hot_face', 'cold_face', 'woozy_face', 'dizzy_face', 'exploding_head', 'cowboy_hat_face', 'partying_face', 'sunglasses', 'nerd_face', 'monocle_face', 'confused', 'worried', 'slightly_frowning_face', 'frowning_face', 'open_mouth', 'hushed', 'astonished', 'flushed', 'pleading_face', 'frowning', 'anguished', 'fearful', 'cold_sweat', 'disappointed_relieved', 'cry', 'sob', 'scream', 'confounded', 'persevere', 'disappointed', 'sweat', 'weary', 'tired_face', 'yawning_face', 'triumph', 'rage', 'angry', 'cursing_face', 'smiling_imp', 'imp', 'skull', 'skull_crossbones', 'poop', 'clown_face', 'ghost', 'alien', 'space_invader', 'robot', 'jack_o_lantern', 'see_no_evil', 'hear_no_evil', 'speak_no_evil'];
      return faceExact.some(f => n === f || n.startsWith(f + '_') || n.endsWith('_' + f) || (n.includes('face') && !n.includes('surface') && !n.includes('interface')));
    }
  },
  {
    id: 'human',
    label: 'Pessoas',
    test: e => {
      const n = (e.name || '').toLowerCase();
      if (n.startsWith('man_') || n.startsWith('woman_') || n.startsWith('person_') || n.startsWith('boy') || n.startsWith('girl') || n.startsWith('baby') || n.startsWith('adult') || n.startsWith('people') || n.startsWith('family_') || n.startsWith('couple_') || n.startsWith('two_men') || n.startsWith('two_women') || n.startsWith('men_') || n.startsWith('women_') || n.startsWith('holding_hands') || n === 'man' || n === 'woman' || n === 'person' || n === 'baby' || n === 'boy' || n === 'girl' || n === 'child' || n === 'older_man' || n === 'older_woman' || n === 'older_adult' || n === 'deaf_woman' || n === 'deaf_man' || n === 'deaf_person' || n === 'pregnant_woman' || n === 'breast_feeding' || n === 'woman_with_veil' || n === 'blond_haired_woman' || n === 'blond_haired_man' || n === 'blond_haired_person') return true;
      const roles = ['ninja', 'superhero', 'supervillain', 'mage', 'fairy', 'vampire', 'merperson', 'merman', 'mermaid', 'elf', 'genie', 'zombie', 'guard', 'police', 'detective', 'firefighter', 'doctor', 'nurse', 'judge', 'pilot', 'astronaut', 'cook', 'mechanic', 'scientist', 'artist', 'singer', 'teacher', 'student', 'worker', 'farmer'];
      return roles.some(r => n === r || n.startsWith(r + '_') || n.endsWith('_' + r) || n.includes('_' + r + '_'));
    }
  },
  {
    id: 'hands',
    label: 'Mãos & Gestos',
    test: e => {
      const items = ['wave', 'raised_back_of_hand', 'raised_hand_with_fingers_splayed', 'hand_splayed', 'vulcan_salute', 'rightwards_hand', 'leftwards_hand', 'palm_down_hand', 'palm_up_hand', 'ok_hand', 'pinching_hand', 'pinched_fingers', 'victory_hand', 'crossed_fingers', 'love_you_gesture', 'metal', 'call_me_hand', 'point_left', 'point_right', 'point_up_2', 'point_down', 'point_up', 'middle_finger', 'raised_fist', 'fist', 'punch', 'left_facing_fist', 'right_facing_fist', 'clap', 'raised_hands', 'open_hands', 'palms_up_together', 'handshake', 'pray', 'writing_hand', 'nail_care', 'selfie', 'muscle', 'mechanical_arm', 'mechanical_leg', 'leg', 'foot', 'ear', 'nose', 'brain', 'eyes', 'eye', 'tongue', 'mouth', 'lips', 'hand', 'finger', 'arm'];
      const n = (e.name || '').toLowerCase();
      return items.some(k => n === k || n.startsWith(k + '_') || n.endsWith('_' + k) || n.includes('_' + k + '_'));
    }
  },
  {
    id: 'hearts',
    label: 'Corações',
    test: e => {
      const n = (e.name || '').toLowerCase();
      return (n.includes('heart') && !n.includes('hearth')) || n === 'cupid' || n === 'love_letter' || n === 'kiss';
    }
  },
  {
    id: 'animals',
    label: 'Animais',
    test: e => {
      const items = ['animal', 'cat', 'black_cat', 'dog', 'guide_dog', 'service_dog', 'poodle', 'wolf', 'fox_face', 'fox', 'raccoon', 'cat_face', 'dog_face', 'lion_face', 'lion', 'tiger_face', 'tiger', 'leopard', 'horse_face', 'horse', 'racehorse', 'unicorn_face', 'unicorn', 'zebra', 'deer', 'cow_face', 'cow', 'ox', 'water_buffalo', 'pig_face', 'pig', 'boar', 'pig_nose', 'ram', 'ewe', 'goat', 'camel', 'dromedary_camel', 'llama', 'giraffe', 'elephant', 'rhinoceros', 'hippopotamus', 'mouse_face', 'mouse', 'rat', 'hamster', 'rabbit_face', 'rabbit', 'chipmunk', 'hedgehog', 'bat', 'bear', 'koala', 'panda_face', 'sloth', 'otter', 'skunk', 'kangaroo', 'badger', 'feet', 'turkey', 'chicken', 'rooster', 'hatching_chick', 'baby_chick', 'hatched_chick', 'bird', 'penguin', 'dove', 'eagle', 'duck', 'swan', 'owl', 'flamingo', 'peacock', 'parrot', 'frog', 'crocodile', 'turtle', 'lizard', 'snake', 'dragon_face', 'dragon', 'sauropod', 't_rex', 'whale', 'spouting_whale', 'dolphin', 'fish', 'tropical_fish', 'blowfish', 'shark', 'octopus', 'shell', 'snail', 'butterfly', 'bug', 'ant', 'bee', 'honeybee', 'beetle', 'lady_beetle', 'cricket', 'spider', 'spider_web', 'scorpion', 'mosquito', 'fly', 'worm', 'microbe'];
      const n = (e.name || '').toLowerCase();
      return items.some(k => n === k || n.startsWith(k + '_') || n.endsWith('_' + k) || n.includes('_' + k + '_'));
    }
  },
  {
    id: 'nature',
    label: 'Natureza',
    test: e => {
      const items = ['seedling', 'potted_plant', 'evergreen_tree', 'deciduous_tree', 'palm_tree', 'cactus', 'tulip', 'rose', 'hibiscus', 'cherry_blossom', 'sunflower', 'blossom', 'herb', 'four_leaf_clover', 'shamrock', 'maple_leaf', 'fallen_leaf', 'leaf_fluttering_in_wind', 'leaves', 'bouquet', 'ear_of_rice', 'tanabata_tree', 'mushroom', 'wood', 'mountain', 'volcano', 'mount_fuji', 'camping', 'beach_with_umbrella', 'desert', 'island', 'national_park', 'rock', 'seed', 'plant', 'tree', 'flower'];
      const n = (e.name || '').toLowerCase();
      return items.some(k => n === k || n.startsWith(k + '_') || n.endsWith('_' + k) || n.includes('_' + k + '_'));
    }
  },
  {
    id: 'weather',
    label: 'Clima',
    test: e => {
      const items = ['sunny', 'sun_with_face', 'sun_behind_cloud', 'sun_behind_small_cloud', 'sun_behind_large_cloud', 'sun_behind_rain_cloud', 'cloud', 'cloud_with_rain', 'cloud_with_lightning_and_rain', 'cloud_with_lightning', 'cloud_with_snow', 'snowflake', 'snowman', 'wind_face', 'fog', 'umbrella', 'umbrella_with_rain_drops', 'zap', 'rainbow', 'crescent_moon', 'moon', 'full_moon', 'waxing_gibbous_moon', 'first_quarter_moon', 'waxing_crescent_moon', 'new_moon', 'waning_crescent_moon', 'last_quarter_moon', 'waning_gibbous_moon', 'new_moon_with_face', 'full_moon_with_face', 'star', 'star2', 'stars', 'sparkles', 'comet', 'milky_way', 'tornado', 'cyclone', 'droplet', 'ocean', 'water_wave', 'fire', 'flame', 'thermometer', 'sun', 'foggy', 'glowing_star', 'shooting_star'];
      const n = (e.name || '').toLowerCase();
      return items.some(k => n === k || n.startsWith(k + '_') || n.endsWith('_' + k) || n.includes('_' + k + '_'));
    }
  },
  {
    id: 'food',
    label: 'Comida',
    test: e => {
      const items = ['grapes', 'melon', 'watermelon', 'tangerine', 'lemon', 'banana', 'pineapple', 'mango', 'apple', 'green_apple', 'pear', 'peach', 'cherries', 'strawberry', 'kiwifruit', 'tomato', 'coconut', 'avocado', 'eggplant', 'potato', 'carrot', 'ear_of_corn', 'hot_pepper', 'cucumber', 'leafy_green', 'broccoli', 'garlic', 'onion', 'mushroom', 'peanuts', 'chestnut', 'bread', 'croissant', 'baguette_bread', 'pretzel', 'bagel', 'pancakes', 'waffle', 'cheese', 'meat_on_bone', 'poultry_leg', 'cut_of_meat', 'bacon', 'hamburger', 'fries', 'pizza', 'hotdog', 'sandwich', 'taco', 'burrito', 'stuffed_flatbread', 'falafel', 'egg', 'fried_egg', 'shallow_pan_of_food', 'stew', 'bowl_with_spoon', 'green_salad', 'popcorn', 'butter', 'salt', 'canned_food', 'bento', 'rice_cracker', 'rice_ball', 'rice', 'curry', 'ramen', 'spaghetti', 'sweet_potato', 'oden', 'sushi', 'fried_shrimp', 'fish_cake', 'moon_cake', 'dango', 'dumpling', 'fortune_cookie', 'takeout_box', 'crab', 'lobster', 'shrimp', 'squid', 'oyster', 'icecream', 'shaved_ice', 'ice_cream', 'doughnut', 'cookie', 'birthday', 'cake', 'cupcake', 'pie', 'chocolate_bar', 'candy', 'lollipop', 'custard', 'honey_pot', 'baby_bottle', 'glass_of_milk', 'coffee', 'tea', 'teapot', 'mate', 'cup_with_straw', 'beverage_box', 'sake', 'beer', 'beers', 'clinking_glasses', 'wine_glass', 'cocktail', 'tropical_drink', 'champagne', 'fork_and_knife', 'spoon', 'kitchen_knife'];
      const n = (e.name || '').toLowerCase();
      return items.some(k => n === k || n.startsWith(k + '_') || n.endsWith('_' + k) || n.includes('_' + k + '_'));
    }
  },
  {
    id: 'zodiac',
    label: 'Signos',
    test: e => {
      const items = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpius', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces', 'ophiuchus'];
      const n = (e.name || '').toLowerCase();
      return items.some(k => n === k || n.startsWith(k + '_') || n.endsWith('_' + k) || n.includes('_' + k + '_'));
    }
  },
  {
    id: 'sports',
    label: 'Esportes',
    test: e => {
      const items = ['soccer', 'basketball', 'football', 'baseball', 'softball', 'tennis', 'volleyball', 'rugby_football', 'flying_disc', '8ball', 'yo_yo', 'ping_pong', 'badminton', 'ice_hockey', 'field_hockey', 'lacrosse', 'cricket_game', 'cricket', 'goal_net', 'golf', 'kite', 'bow_and_arrow', 'archery', 'fishing_pole_and_fish', 'diving_mask', 'boxing_glove', 'martial_arts_uniform', 'ice_skate', 'curling_stone', 'sled', 'skate', 'ski', 'snowboarder', 'skateboard', 'roller_skate', 'medal', 'trophy', 'sports_medal', 'first_place_medal', 'second_place_medal', 'third_place_medal'];
      const n = (e.name || '').toLowerCase();
      return items.some(k => n === k || n.startsWith(k + '_') || n.endsWith('_' + k) || n.includes('_' + k + '_'));
    }
  },
  {
    id: 'arts',
    label: 'Música & Arte',
    test: e => {
      const items = ['art', 'palette', 'performing_arts', 'circus_tent', 'microphone', 'headphones', 'musical_score', 'musical_note', 'notes', 'musical_keyboard', 'drum', 'long_drum', 'saxophone', 'trumpet', 'guitar', 'banjo', 'violin', 'accordion', 'clapper', 'film_frames', 'tickets', 'ticket', 'yarn', 'thread', 'sewing_needle', 'frame_photo', 'framed_picture', 'drama'];
      const n = (e.name || '').toLowerCase();
      return items.some(k => n === k || n.startsWith(k + '_') || n.endsWith('_' + k) || n.includes('_' + k + '_'));
    }
  },
  {
    id: 'tech',
    label: 'Tecnologia',
    test: e => {
      const items = ['computer', 'desktop_computer', 'laptop', 'keyboard', 'trackball', 'mouse_three_button', 'printer', 'floppy_disk', 'cd', 'dvd', 'vhs', 'camera', 'camera_flash', 'video_camera', 'movie_camera', 'projector', 'tv', 'television', 'radio', 'telephone', 'phone', 'iphone', 'pager', 'fax', 'battery', 'electric_plug', 'bulb', 'flashlight', 'satellite_antenna', 'satellite', 'joystick', 'video_game'];
      const n = (e.name || '').toLowerCase();
      return items.some(k => n === k || n.startsWith(k + '_') || n.endsWith('_' + k) || n.includes('_' + k + '_'));
    }
  },
  {
    id: 'clothes',
    label: 'Vestimentas',
    test: e => {
      const items = ['shirt', 'dress', 'shoe', 'shoes', 'hat', 'pants', 'sock', 'socks', 'boot', 'boots', 'coat', 'tie', 'necktie', 'glasses', 'sunglasses', 'uniform', 'bag', 'purse', 'handbag', 'pouch', 'briefcase', 'backpack', 'glove', 'gloves', 'scarf', 'bikini', 'swimsuit', 'one_piece_swimsuit', 'swim_brief', 'shorts', 'cap', 'billed_cap', 'crown', 'kimono', 'sari', 'safety_vest', 'helmet', 'jeans', 'tshirt', 'running_shirt_with_sash', 'womans_clothes', 'tophat', 'high_heel', 'sandal', 'ballet_shoes', 'flat_shoe', 'womans_flat_shoe', 'running_shoe', 'hiking_boot', 'thong_sandal', 'clapper_shoe', 'graduation_cap', 'ring', 'gem', 'lipstick', 'footprints'];
      const n = (e.name || '').toLowerCase();
      return items.some(k => n === k || n.startsWith(k + '_') || n.endsWith('_' + k) || n.includes('_' + k + '_'));
    }
  },
  {
    id: 'buildings',
    label: 'Construções',
    test: e => {
      const items = ['house', 'houses', 'building', 'buildings', 'castle', 'tower', 'hospital', 'school', 'bank', 'factory', 'office_building', 'department_store', 'post_office', 'european_post_office', 'church', 'mosque', 'synagogue', 'hindu_temple', 'kaaba', 'shinto_shrine', 'stadium', 'hotel', 'love_hotel', 'convenience_store', 'bridge', 'bridge_at_night', 'construction', 'pagoda', 'hut', 'fountain', 'monument', 'statue_of_liberty', 'classical_building', 'brick', 'derelict_house_building', 'tokyo_tower'];
      const n = (e.name || '').toLowerCase();
      return items.some(k => n === k || n.startsWith(k + '_') || n.endsWith('_' + k) || n.includes('_' + k + '_'));
    }
  },
  {
    id: 'vehicles',
    label: 'Veículos',
    test: e => {
      const items = ['car', 'red_car', 'taxi', 'oncoming_taxi', 'blue_car', 'bus', 'oncoming_bus', 'trolleybus', 'minibus', 'ambulance', 'fire_engine', 'police_car', 'oncoming_police_car', 'truck', 'articulated_lorry', 'tractor', 'motor_scooter', 'scooter', 'manual_wheelchair', 'motorized_wheelchair', 'auto_rickshaw', 'bike', 'bicycle', 'mountain_biking', 'biking', 'skateboard', 'roller_skate', 'train', 'steam_locomotive', 'railway_car', 'bullettrain_side', 'bullettrain_front', 'monorail', 'station', 'tram', 'train2', 'metro', 'light_rail', 'mountain_railway', 'cableway', 'aerial_tramway', 'railway_track', 'airplane', 'small_airplane', 'flight_departure', 'flight_arrival', 'parachute', 'seat', 'helicopter', 'suspension_railway', 'rocket', 'flying_saucer', 'satellite', 'boat', 'sailboat', 'motor_boat', 'speedboat', 'ferry', 'passenger_ship', 'ship', 'canoe', 'anchor'];
      const n = (e.name || '').toLowerCase();
      return items.some(k => n === k || n.startsWith(k + '_') || n.endsWith('_' + k) || n.includes('_' + k + '_'));
    }
  },
  {
    id: 'signs',
    label: 'Placas',
    test: e => {
      const items = ['no_entry', 'no_entry_sign', 'no_pedestrians', 'no_smoking', 'no_mobile_phones', 'no_bicycles', 'no_bell', 'octagonal_sign', 'stop_sign', 'stop_button', 'warning', 'prohibited', 'prohibition', 'forbidden', 'caution', 'radioactive', 'biohazard', 'hazard', 'cross_mark', 'negative_squared_cross_mark', 'heavy_check_mark', 'recycle', 'beginner', 'trident', 'children_crossing', 'restroom', 'parking', 'atm', 'sos', 'name_badge', 'barrier', 'do_not_litter', 'non_potable_water', 'underage', 'no_one_under_eighteen', 'heavy_plus_sign', 'heavy_minus_sign', 'heavy_division_sign', 'heavy_dollar_sign', 'heavy_equals_sign', 'placard', 'information_source', 'signal_strength', 'arrow_up', 'arrow_down', 'arrow_left', 'arrow_right', 'arrow_upper_left', 'arrow_upper_right', 'arrow_lower_left', 'arrow_lower_right', 'left_right_arrow', 'up_down_arrow', 'arrows_counterclockwise', 'arrow_right_hook', 'leftwards_arrow_with_hook', 'arrow_heading_up', 'arrow_heading_down', 'traffic_light', 'vertical_traffic_light'];
      const n = (e.name || '').toLowerCase();
      return items.some(k => n === k || n.startsWith(k + '_') || n.endsWith('_' + k) || n.includes('_' + k + '_'));
    }
  },
  {
    id: 'objects',
    label: 'Objetos',
    test: e => {
      const items = ['phone', 'telephone', 'iphone', 'calling', 'computer', 'desktop_computer', 'keyboard', 'trackball', 'printer', 'mouse_three_button', 'floppy_disk', 'cd', 'dvd', 'vhs', 'camera', 'camera_flash', 'video_camera', 'movie_camera', 'projector', 'film_frames', 'telephone_receiver', 'pager', 'fax', 'tv', 'television', 'radio', 'microphone', 'level_slider', 'control_knobs', 'compass', 'stopwatch', 'timer_clock', 'alarm_clock', 'clock', 'hourglass', 'hourglass_flowing_sand', 'satellite_antenna', 'battery', 'electric_plug', 'bulb', 'flashlight', 'candle', 'fire_extinguisher', 'wastebasket', 'oil_drum', 'money_with_wings', 'dollar', 'yen', 'euro', 'pound', 'banknote', 'credit_card', 'gem', 'balance_scale', 'wrench', 'hammer', 'hammer_and_pick', 'hammer_and_wrench', 'pick', 'nut_and_bolt', 'gear', 'bricks', 'chains', 'magnet', 'gun', 'pistol', 'bomb', 'firecracker', 'axe', 'knife', 'dagger', 'crossed_swords', 'shield', 'key', 'old_key', 'lock', 'unlock', 'lock_with_ink_pen', 'closed_lock_with_key', 'bell', 'microscope', 'telescope', 'satellite', 'syringe', 'drop_of_blood', 'pill', 'adhesive_bandage', 'stethoscope', 'door', 'bed', 'couch_and_lamp', 'chair', 'toilet', 'shower', 'bathtub', 'razor', 'lotion_bottle', 'safety_pin', 'broom', 'basket', 'roll_of_paper', 'soap', 'sponge', 'bucket', 'keycap'];
      const n = (e.name || '').toLowerCase();
      return items.some(k => n === k || n.startsWith(k + '_') || n.endsWith('_' + k) || n.includes('_' + k + '_'));
    }
  },
  {
    id: 'activities',
    label: 'Atividades',
    test: e => {
      const items = ['jack_o_lantern', 'christmas_tree', 'fireworks', 'sparkler', 'firecracker', 'sparkles', 'balloon', 'tada', 'confetti_ball', 'tanabata_tree', 'bamboo', 'dolls', 'flags', 'wind_chime', 'rice_scene', 'ribbon', 'gift', 'reminder_ribbon', 'tickets', 'ticket', 'dice', 'jigsaw', 'teddy_bear', 'pinata', 'nesting_dolls', 'spades', 'hearts', 'diamonds', 'clubs', 'chess_pawn', 'black_joker', 'mahjong', 'flower_playing_cards'];
      const n = (e.name || '').toLowerCase();
      return items.some(k => n === k || n.startsWith(k + '_') || n.endsWith('_' + k) || n.includes('_' + k + '_'));
    }
  },
  {
    id: 'religion',
    label: 'Religião',
    test: e => {
      const explicit = new Set([
        'church', 'cross', 'latin_cross', 'orthodox_cross', 'star_of_david', 'star_and_crescent',
        'peace_symbol', 'peace', 'yin_yang', 'wheel_of_dharma', 'om_symbol', 'om', 'menorah', 'dharma', 'kaaba',
        'mosque', 'synagogue', 'hindu_temple', 'place_of_worship', 'shinto_shrine', 'torii',
        'prayer_beads', 'rosary', 'angel', 'baby_angel', 'pray', 'folded_hands', 'dove_of_peace', 'dove'
      ]);
      return explicit.has((e.name || '').toLowerCase());
    }
  },
  {
    id: 'flags',
    label: 'Bandeiras',
    test: e => {
      const n = (e.name || '').toLowerCase();
      return n.startsWith('flag_') || n === 'flags' || n === 'triangular_flag' || n === 'waving_flag' || n === 'pirate_flag' || n === 'rainbow_flag' || n === 'crossed_flags' || n === 'chequered_flag' || n === 'black_flag' || n === 'white_flag';
    }
  }
];

function matchEmojiToCategory(e, def) {
  if (!e || !def || typeof def.test !== 'function') return false;
  return def.test(e);
}

function parseTokenIndices(inputStr) {
  const result = new Set();
  if (!inputStr || typeof inputStr !== 'string') return result;

  const raw = inputStr.trim();
  if (!raw) return result;

  const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null;

  const rawItems = raw.includes(',') || raw.includes(';') || raw.includes('|') || raw.includes('\n')
    ? raw.split(/[,;|\n]+/)
    : [raw];

  for (let item of rawItems) {
    item = item.trim();
    if (!item) continue;

    // 1. Graphemes / unicode exatos
    if (segmenter) {
      const graphemes = Array.from(segmenter.segment(item), s => s.segment.trim()).filter(Boolean);
      for (const g of graphemes) {
        if (/[^\u0000-\u007F]/.test(g)) {
          const normG = normalizeEmojiStr(g);
          for (let i = 0; i < numAtlasEmojis; i++) {
            const normSurr = normalizeEmojiStr(emojiSurrogatesList[i]);
            if (normSurr && normSurr === normG) {
              result.add(i);
            }
          }
        }
      }
    } else if (/[^\u0000-\u007F]/.test(item)) {
      const normItem = normalizeEmojiStr(item);
      for (let i = 0; i < numAtlasEmojis; i++) {
        const normSurr = normalizeEmojiStr(emojiSurrogatesList[i]);
        if (normSurr && normSurr === normItem) {
          result.add(i);
        }
      }
    }

    // 2. Palavras-chave de categorias
    const lowerItem = item.toLowerCase();
    const matchedCat = CATEGORY_DEFINITIONS.find(d => d.id === lowerItem || d.label.toLowerCase() === lowerItem);
    if (matchedCat) {
      const indices = categoryIndicesMap[matchedCat.id] || [];
      indices.forEach(i => result.add(i));
      continue;
    }

    // 3. Suporte a curingas
    if (lowerItem.includes('*')) {
      const clean = lowerItem.replace(/\*/g, '');
      if (clean) {
        const isPrefix = lowerItem.endsWith('*') && !lowerItem.startsWith('*');
        const isSuffix = lowerItem.startsWith('*') && !lowerItem.endsWith('*');
        const isContains = lowerItem.startsWith('*') && lowerItem.endsWith('*');

        for (let i = 0; i < numAtlasEmojis; i++) {
          const name = emojiNamesList[i];
          if (isPrefix && name.startsWith(clean)) result.add(i);
          else if (isSuffix && name.endsWith(clean)) result.add(i);
          else if (isContains && name.includes(clean)) result.add(i);
          else if (name.includes(clean)) result.add(i);
        }
      }
      continue;
    }

    // 4. Nomes, aliases e codepoints
    const words = item
      .toLowerCase()
      .split(/[\s]+/)
      .map(w => w.trim().replace(/^:+|:+$/g, ''))
      .filter(w => w.length > 0 && /^[\w-]+$/.test(w));

    for (const token of words) {
      for (let i = 0; i < numAtlasEmojis; i++) {
        const name = emojiNamesList[i];
        const codepoint = emojiCodepointsList[i];
        const allNames = emojiAllNamesList[i];

        if (name === token) {
          result.add(i);
        } else if (codepoint === token) {
          result.add(i);
        } else if (allNames && allNames.includes(token)) {
          result.add(i);
        }
      }
    }
  }

  return result;
}

function syncExcludedTextFromSet() {
  if (!atlasMetadata || !atlasMetadata.emojis || numAtlasEmojis === 0) return;
  if (excludedIndicesSet.size === 0) {
    params.excludedText = '';
  } else if (excludedIndicesSet.size >= numAtlasEmojis) {
    params.excludedText = '*';
  } else {
    const names = [];
    for (const idx of excludedIndicesSet) {
      if (idx < numAtlasEmojis) {
        names.push(emojiNamesList[idx] || atlasMetadata.emojis[idx].name);
      }
    }
    params.excludedText = names.join(', ');
  }
  if (typeof guiControllers !== 'undefined' && guiControllers.excludedText) {
    guiControllers.excludedText.setValue(params.excludedText);
  }
}

function syncForcedTextFromSet() {
  if (!atlasMetadata || !atlasMetadata.emojis || numAtlasEmojis === 0) return;
  if (forcedIndicesSet.size === 0) {
    params.forcedText = '';
  } else {
    const names = [];
    for (const idx of forcedIndicesSet) {
      if (idx < numAtlasEmojis) {
        names.push(emojiNamesList[idx] || atlasMetadata.emojis[idx].name);
      }
    }
    params.forcedText = names.join(', ');
  }
  if (typeof guiControllers !== 'undefined' && guiControllers.forcedText) {
    guiControllers.forcedText.setValue(params.forcedText);
  }
}
