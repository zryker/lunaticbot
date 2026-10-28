const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  PermissionFlagsBits,
  SlashCommandBuilder,
  REST,
  Routes
} = require('discord.js');
const fs = require('fs');

// Configuración principal del Bot
const TOKEN = 'TU_BOT_TOKEN_AQUI';
const CLIENT_ID = 'ID_DE_TU_BOT_AQUI';

// Manejo de configuración guardada en archivo local
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

// Definición de Slash Commands
const commands = [
  // Configuración de Canales
  new SlashCommandBuilder()
    .setName('configurar')
    .setDescription('Configura los canales del bot')
    .addSubcommand(sub =>
      sub.setName('canal')
         .setDescription('Establece un canal para una función específica')
         .addStringOption(opt =>
           opt.setName('tipo')
              .setDescription('Tipo de canal')
              .setRequired(true)
              .addChoices(
                { name: 'Bienvenida', value: 'bienvenida' },
                { name: 'Despedida', value: 'despedida' },
                { name: 'Sugerencias', value: 'sugerencias' },
                { name: 'Logs', value: 'logs' }
              )
         )
         .addChannelOption(opt =>
           opt.setName('canal')
              .setDescription('Selecciona el canal de texto')
              .setRequired(true)
         )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  // Moderación
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Banea a un usuario del servidor')
    .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a banear').setRequired(true))
    .addStringOption(opt => opt.setName('razon').setDescription('Razón del baneo'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulsa a un usuario del servidor')
    .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a expulsar').setRequired(true))
    .addStringOption(opt => opt.setName('razon').setDescription('Razón de la expulsión'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Elimina una cantidad de mensajes (1-100)')
    .addIntegerOption(opt => opt.setName('cantidad').setDescription('Número de mensajes').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Aisla temporalmente a un usuario')
    .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a aislar').setRequired(true))
    .addIntegerOption(opt => opt.setName('tiempo').setDescription('Tiempo en minutos').setRequired(true))
    .addStringOption(opt => opt.setName('razon').setDescription('Razón del aislamiento'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  // Sugerencias
  new SlashCommandBuilder()
    .setName('sugerir')
    .setDescription('Envía una sugerencia a la comunidad')
    .addStringOption(opt => opt.setName('sugerencia').setDescription('Tu sugerencia').setRequired(true))
].map(cmd => cmd.toJSON());

// Evento Ready: Registrar comandos
client.once('ready', async () => {
  console.log(`🤖 ${client.user.tag} de Lunatic Studio se ha iniciado correctamente!`);
  
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('Cargando comandos (/) ...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Comandos registrados con éxito.');
  } catch (error) {
    console.error('Error al registrar comandos:', error);
  }
});

// ==========================================
// 1. BIENVENIDAS Y DESPEDIDAS
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
// 2. INTERACCIONES Y COMANDOS (/)
// ==========================================

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const { commandName, options } = interaction;

    // --- COMANDO CONFIGURAR ---
    if (commandName === 'configurar') {
      const tipo = options.getString('tipo');
      const canal = options.getChannel('canal');

      if (canal.type !== 0) { // 0 = GuildText (Canal de texto)
        return interaction.reply({ content: '❌ Por favor selecciona un canal de texto válido.', ephemeral: true });
      }

      setConfig(interaction.guild.id, tipo, canal.id);
      return interaction.reply({ content: `✅ Canal de **${tipo}** configurado correctamente a ${canal}.`, ephemeral: true });
    }

    // --- COMANDO SUGERIR ---
    if (commandName === 'sugerir') {
      const sugerenciaTexto = options.getString('sugerencia');
      const sugChannelId = getConfig(interaction.guild.id, 'sugerencias');

      if (!sugChannelId) {
        return interaction.reply({ content: '❌ El canal de sugerencias no ha sido configurado. Un administrador debe usar `/configurar canal tipo:sugerencias canal:#canal`.', ephemeral: true });
      }

      const sugChannel = interaction.guild.channels.cache.get(sugChannelId);
      if (!sugChannel) {
        return interaction.reply({ content: '❌ El canal configurado para sugerencias ya no existe.', ephemeral: true });
      }

      const embedSugerencia = new EmbedBuilder()
        .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
        .setTitle('💡 Nueva Sugerencia')
        .setDescription(sugerenciaTexto)
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

      await sugChannel.send({ embeds: [embedSugerencia], components: [row] });
      return interaction.reply({ content: '✅ Tu sugerencia ha sido enviada con éxito.', ephemeral: true });
    }

    // --- COMANDO BAN ---
    if (commandName === 'ban') {
      const target = options.getUser('usuario');
      const razon = options.getString('razon') || 'Sin razón especificada';
      const member = interaction.guild.members.cache.get(target.id);

      if (!member) return interaction.reply({ content: 'Usuario no encontrado.', ephemeral: true });
      if (!member.bannable) return interaction.reply({ content: 'No puedo banear a este usuario.', ephemeral: true });

      await member.ban({ reason: razon });
      return interaction.reply({ content: `🔨 **${target.tag}** ha sido baneado. Razón: *${razon}*` });
    }

    // --- COMANDO KICK ---
    if (commandName === 'kick') {
      const target = options.getUser('usuario');
      const razon = options.getString('razon') || 'Sin razón especificada';
      const member = interaction.guild.members.cache.get(target.id);

      if (!member) return interaction.reply({ content: 'Usuario no encontrado.', ephemeral: true });
      if (!member.kickable) return interaction.reply({ content: 'No puedo expulsar a este usuario.', ephemeral: true });

      await member.kick(razon);
      return interaction.reply({ content: `👟 **${target.tag}** ha sido expulsado. Razón: *${razon}*` });
    }

    // --- COMANDO CLEAR ---
    if (commandName === 'clear') {
      const cantidad = options.getInteger('cantidad');
      if (cantidad < 1 || cantidad > 100) return interaction.reply({ content: 'Ingresa un número entre 1 y 100.', ephemeral: true });

      await interaction.channel.bulkDelete(cantidad, true);
      return interaction.reply({ content: `🧹 Se han eliminado **${cantidad}** mensajes.`, ephemeral: true });
    }

    // --- COMANDO TIMEOUT ---
    if (commandName === 'timeout') {
      const target = options.getUser('usuario');
      const tiempo = options.getInteger('tiempo');
      const razon = options.getString('razon') || 'Sin razón especificada';
      const member = interaction.guild.members.cache.get(target.id);

      if (!member) return interaction.reply({ content: 'Usuario no encontrado.', ephemeral: true });

      await member.timeout(tiempo * 60 * 1000, razon);
      return interaction.reply({ content: `🔇 **${target.tag}** ha sido aislado por ${tiempo} minuto(s). Razón: *${razon}*` });
    }
  }

  // BOTONES DE VOTO PARA SUGERENCIAS
  if (interaction.isButton()) {
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
  }
});

// ==========================================
// 3. CANAL DE LOGS (Auditoría)
// ==========================================

client.on('messageDelete', async (message) => {
  if (message.partial || message.author?.bot) return;

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
  if (oldMessage.partial || oldMessage.author?.bot) return;
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
  
