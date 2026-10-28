const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  PermissionFlagsBits 
} = require('discord.js');
const fs = require('fs');

// Configuración principal usando variables de entorno de Render o respaldo
const TOKEN = process.env.TOKEN || 'TU_BOT_TOKEN_AQUI';
const PREFIX = '!';

// Archivo de configuración local para canales
const CONFIG_FILE = './config.json';
let configs = {};

if (fs.existsSync(CONFIG_FILE)) {
  try {
    configs = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (e) {
    configs = {};
  }
}

function saveConfig() {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2));
}

function getConfig(guildId, key) {
  return configs[guildId]?.[key] || null;
}

function setConfig(guildId, key, value) {
  if (!configs[guildId]) configs[guildId] = {};
  configs[guildId][key] = value;
  saveConfig();
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`🤖 ${client.user.tag} de Lunatic Studio se ha iniciado correctamente con prefijo (${PREFIX})!`);
});

// ==========================================
// 1. BIENVENIDAS Y DESPEDIDAS (Con Embeds)
// ==========================================

client.on('guildMemberAdd', async (member) => {
  const channelId = getConfig(member.guild.id, 'bienvenida');
  if (!channelId) return;
  const channel = member.guild.channels.cache.get(channelId);
  if (!channel) return;

  const welcomeEmbed = new EmbedBuilder()
    .setTitle('✨ ¡Nuevo Miembro en Lunatic Studio!')
    .setDescription(`¡Hola ${member}, bienvenido/a a **${member.guild.name}**! 🎉\n\nEsperamos que disfrutes tu estancia. No olvides revisar los canales de reglas e información.`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setColor('#00d2ff')
    .setFooter({ text: `Miembro #${member.guild.memberCount}`, iconURL: member.guild.iconURL() })
    .setTimestamp();

  channel.send({ embeds: [welcomeEmbed] });
});

client.on('guildMemberRemove', async (member) => {
  const channelId = getConfig(member.guild.id, 'despedida');
  if (!channelId) return;
  const channel = member.guild.channels.cache.get(channelId);
  if (!channel) return;

  const goodbyeEmbed = new EmbedBuilder()
    .setTitle('👋 Un usuario ha salido')
    .setDescription(`**${member.user.tag}** ha abandonado el servidor. ¡Esperamos verle de nuevo!`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setColor('#ff4757')
    .setFooter({ text: `Quedan ${member.guild.memberCount} miembros` })
    .setTimestamp();

  channel.send({ embeds: [goodbyeEmbed] });
});

// ==========================================
// 2. COMANDOS CON PREFIJO (!) Y SUGERENCIAS
// ==========================================

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  // Sistema de Sugerencias Automático (Convierte mensajes en Embeds con Botones)
  const sugChannelId = getConfig(message.guild.id, 'sugerencias');
  if (sugChannelId && message.channel.id === sugChannelId && !message.content.startsWith(PREFIX)) {
    const embedSugerencia = new EmbedBuilder()
      .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
      .setTitle('💡 Nueva Sugerencia')
      .setDescription(message.content)
      .setColor('#eccc68')
      .addFields(
        { name: 'Estado', value: '⏳ En espera de votación', inline: true },
        { name: 'Votos A Favor', value: '0', inline: true },
        { name: 'Votos En Contra', value: '0', inline: true }
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('sug_up').setEmoji('👍').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('sug_down').setEmoji('👎').setStyle(ButtonStyle.Danger)
    );

    await message.delete().catch(() => {});
    await message.channel.send({ embeds: [embedSugerencia], components: [row] });
    return;
  }

  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // --- !help (Comando de Ayuda en Embed) ---
  if (command === 'help') {
    const helpEmbed = new EmbedBuilder()
      .setTitle('📖 Menú de Ayuda - Lunatic Studio Bot')
      .setDescription('Aquí tienes la lista de comandos disponibles en el bot:')
      .setColor('#7158e2')
      .addFields(
        { name: '⚙️ Configuración (Admin)', value: '`!configurar [bienvenida/despedida/sugerencias/logs] #canal`' },
        { name: '💡 Sugerencias', value: 'Escribe cualquier mensaje directamente en el canal de sugerencias configurado para crear una tarjeta con votación.' },
        { name: '🛡️ Moderación', value: '• `!ban @usuario [razón]`\n• `!kick @usuario [razón]`\n• `!timeout @usuario [minutos] [razón]`\n• `!clear [1-100]`' }
      )
      .setFooter({ text: 'Lunatic Studio Bot • Todos los derechos reservados' })
      .setTimestamp();

    return message.reply({ embeds: [helpEmbed] });
  }

  // --- !configurar [tipo] [#canal] ---
  if (command === 'configurar') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply('❌ No tienes permisos para usar este comando.');
    }

    const tipo = args[0]?.toLowerCase();
    const canal = message.mentions.channels.first();

    if (!['bienvenida', 'despedida', 'sugerencias', 'logs'].includes(tipo) || !canal) {
      return message.reply('❌ Uso correcto: `!configurar [bienvenida/despedida/sugerencias/logs] #canal`');
    }

    setConfig(message.guild.id, tipo, canal.id);
    return message.reply(`✅ Canal de **${tipo}** configurado correctamente a ${canal}.`);
  }

  // --- !ban @usuario [razón] ---
  if (command === 'ban') {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return message.reply('❌ No tienes permisos para banear.');
    }

    const target = message.mentions.members.first();
    const razon = args.slice(1).join(' ') || 'Sin razón especificada';

    if (!target) return message.reply('❌ Menciona a un usuario válido.');
    if (!target.bannable) return message.reply('❌ No puedo banear a este usuario.');

    await target.ban({ reason: razon });
    return message.reply(`🔨 **${target.user.tag}** ha sido baneado. Razón: *${razon}*`);
  }

  // --- !kick @usuario [razón] ---
  if (command === 'kick') {
    if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
      return message.reply('❌ No tienes permisos para expulsar.');
    }

    const target = message.mentions.members.first();
    const razon = args.slice(1).join(' ') || 'Sin razón especificada';

    if (!target) return message.reply('❌ Menciona a un usuario válido.');
    if (!target.kickable) return message.reply('❌ No puedo expulsar a este usuario.');

    await target.kick(razon);
    return message.reply(`👟 **${target.user.tag}** ha sido expulsado. Razón: *${razon}*`);
  }

  // --- !clear [cantidad] ---
  if (command === 'clear') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return message.reply('❌ No tienes permisos para borrar mensajes.');
    }

    const cantidad = parseInt(args[0]);
    if (isNaN(cantidad) || cantidad < 1 || cantidad > 100) {
      return message.reply('❌ Ingresa un número entre 1 y 100.');
    }

    await message.channel.bulkDelete(cantidad, true).catch(() => {});
    const msg = await message.channel.send(`🧹 Se han eliminado **${cantidad}** mensajes.`);
    setTimeout(() => msg.delete().catch(() => {}), 3000);
  }

  // --- !timeout @usuario [minutos] [razón] ---
  if (command === 'timeout') {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply('❌ No tienes permisos para aislar usuarios.');
    }

    const target = message.mentions.members.first();
    const tiempo = parseInt(args[1]);
    const razon = args.slice(2).join(' ') || 'Sin razón especificada';

    if (!target || isNaN(tiempo)) {
      return message.reply('❌ Uso correcto: `!timeout @usuario [minutos] [razón]`');
    }

    await target.timeout(tiempo * 60 * 1000, razon);
    return message.reply(`🔇 **${target.user.tag}** ha sido aislado por ${tiempo} minuto(s). Razón: *${razon}*`);
  }
});

// Manejo de Botones para Sugerencias
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'sug_up' || interaction.customId === 'sug_down') {
    const embed = EmbedBuilder.from(interaction.message.embeds[0]);
    let upVotes = parseInt(embed.data.fields[1].value);
    let downVotes = parseInt(embed.data.fields[2].value);

    if (interaction.customId === 'sug_up') upVotes++;
    if (interaction.customId === 'sug_down') downVotes++;

    embed.spliceFields(1, 1, { name: 'Votos A Favor', value: `${upVotes}`, inline: true });
    embed.spliceFields(2, 1, { name: 'Votos En Contra', value: `${downVotes}`, inline: true });

    await interaction.update({ embeds: [embed] });
  }
});

// ==========================================
// 3. CANAL DE LOGS (Auditoría con Embeds)
// ==========================================

client.on('messageDelete', async (message) => {
  if (message.partial || message.author?.bot || !message.guild) return;

  const logChannelId = getConfig(message.guild.id, 'logs');
  if (!logChannelId) return;
  const logChannel = message.guild.channels.cache.get(logChannelId);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('🗑️ Mensaje Eliminado')
    .setColor('#ff4757')
    .addFields(
      { name: 'Autor', value: `${message.author.tag} (${message.author.id})`, inline: true },
      { name: 'Canal', value: `<#${message.channel.id}>`, inline: true },
      { name: 'Contenido', value: message.content || '*Contenido no disponible o era una imagen*' }
    )
    .setTimestamp();

  logChannel.send({ embeds: [embed] });
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
  if (oldMessage.partial || oldMessage.author?.bot || !oldMessage.guild) return;
  if (oldMessage.content === newMessage.content) return;

  const logChannelId = getConfig(oldMessage.guild.id, 'logs');
  if (!logChannelId) return;
  const logChannel = oldMessage.guild.channels.cache.get(logChannelId);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('✏️ Mensaje Editado')
    .setColor('#eccc68')
    .addFields(
      { name: 'Autor', value: `${oldMessage.author.tag}`, inline: true },
      { name: 'Canal', value: `<#${oldMessage.channel.id}>`, inline: true },
      { name: 'Antes', value: oldMessage.content || '*Sin texto*' },
      { name: 'Después', value: newMessage.content || '*Sin texto*' }
    )
    .setTimestamp();

  logChannel.send({ embeds: [embed] });
});

client.login(TOKEN);
